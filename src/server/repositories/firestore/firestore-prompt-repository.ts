import "server-only";

import type { Prompt } from "@/domain/content/prompt";
import type { SourceType } from "@/domain/content/source";
import {
  ConflictError,
  DuplicateSlugError,
  RepositoryError,
  ValidationError,
} from "@/domain/shared/errors";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import type {
  PromptAdminListFilter,
  PromptAdminPage,
  PromptAdminSort,
  PromptRepository,
} from "@/server/repositories/interfaces/prompt-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "@/server/repositories/interfaces/types";
import { normalizePagination } from "@/server/repositories/interfaces/types";
import {
  decodePromptAdminCursor,
  encodePromptAdminCursor,
  sortValueForPrompt,
} from "@/server/repositories/prompt-admin-cursor";
import type {
  Query as FirestoreQuery,
} from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromPromptDoc, toPromptDoc } from "./mappers";
import { comparePromptsAdmin } from "@/server/repositories/prompt-admin-cursor";

function assertSingleTaxonomyFilter(filter: PromptAdminListFilter | undefined) {
  const count = [filter?.categoryId, filter?.tagId, filter?.audienceId].filter(
    Boolean,
  ).length;
  if (count > 1) {
    throw new ValidationError(
      "Only one taxonomy filter (category, tag, or audience) is supported per query",
      { adminCode: "VALIDATION_ERROR" },
    );
  }
}

export class FirestorePromptRepository implements PromptRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(FIRESTORE_COLLECTIONS.prompts);
  }

  async getById(id: string): Promise<Prompt | null> {
    try {
      const snap = await this.col().doc(id).get();
      if (!snap.exists) return null;
      return fromPromptDoc(snap.id, snap.data());
    } catch (error) {
      throw new RepositoryError("Failed to read prompt", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async getBySlug(slug: string): Promise<Prompt | null> {
    try {
      const snap = await this.col().where("slug", "==", slug).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0]!;
      return fromPromptDoc(doc.id, doc.data());
    } catch (error) {
      throw new RepositoryError("Failed to read prompt by slug", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.getBySlug(slug);
    if (!found) return false;
    return found.id !== excludeId;
  }

  async save(prompt: Prompt, options: SaveOptions): Promise<Prompt> {
    const db = getFirebaseAdminFirestore();
    const ref = this.col().doc(prompt.id);
    try {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists) {
          if (options.expectedRevision !== 0) {
            throw new ConflictError(
              "Cannot create entity with non-zero expected revision",
            );
          }
        } else {
          const existing = fromPromptDoc(current.id, current.data());
          if (existing.revision !== options.expectedRevision) {
            throw new ConflictError("Optimistic concurrency conflict", {
              expectedRevision: options.expectedRevision,
              actualRevision: existing.revision,
            });
          }
        }
        const slugQuery = this.col().where("slug", "==", prompt.slug).limit(5);
        const slugSnap = await tx.get(slugQuery);
        for (const doc of slugSnap.docs) {
          if (doc.id !== prompt.id) {
            throw new DuplicateSlugError("Slug already exists", {
              slug: prompt.slug as string,
            });
          }
        }
        tx.set(ref, toPromptDoc(prompt));
      });
      return structuredClone(prompt);
    } catch (error) {
      if (
        error instanceof ConflictError ||
        error instanceof DuplicateSlugError
      ) {
        throw error;
      }
      throw new RepositoryError("Failed to save prompt", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async list(
    filter?: ContentListFilter,
    pagination?: PaginationInput,
  ): Promise<{ items: Prompt[]; nextCursor: string | null; limit: number }> {
    const { limit, cursor } = normalizePagination(pagination);
    try {
      let query = this.col().orderBy("updatedAt", "desc");
      if (filter?.status) {
        const statuses = Array.isArray(filter.status)
          ? filter.status
          : [filter.status];
        if (statuses.length === 1) {
          query = this.col()
            .where("status", "==", statuses[0])
            .orderBy("updatedAt", "desc");
        }
      }
      const snap = await query.limit(limit + 50).get();
      let items = snap.docs.map((d) => fromPromptDoc(d.id, d.data()));
      if (filter?.status) {
        const statuses = Array.isArray(filter.status)
          ? filter.status
          : [filter.status];
        items = items.filter((i) => statuses.includes(i.status));
      }
      if (filter?.categoryId) {
        items = items.filter((i) =>
          i.categoryIds.includes(filter.categoryId as never),
        );
      }
      if (filter?.tagId) {
        items = items.filter((i) => i.tagIds.includes(filter.tagId as never));
      }
      if (filter?.audienceId) {
        items = items.filter((i) =>
          i.audienceIds.includes(filter.audienceId as never),
        );
      }
      let start = 0;
      if (cursor) {
        const idx = items.findIndex((i) => i.id === cursor);
        start = idx >= 0 ? idx + 1 : 0;
      }
      const page = items.slice(start, start + limit);
      const nextCursor =
        start + limit < items.length
          ? (page[page.length - 1]?.id ?? null)
          : null;
      return { items: page, nextCursor, limit };
    } catch (error) {
      throw new RepositoryError("Failed to list prompts", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listAdmin(
    filter?: PromptAdminListFilter,
    pagination?: PaginationInput,
  ): Promise<PromptAdminPage> {
    assertSingleTaxonomyFilter(filter);
    const sort: PromptAdminSort = filter?.sort ?? "updatedAt_desc";
    const { limit, cursor } = normalizePagination({
      limit: pagination?.limit ?? CONTENT_LIMITS.adminPromptPageDefault,
      cursor: pagination?.cursor,
    });
    if (limit > CONTENT_LIMITS.adminPromptPageMax) {
      throw new ValidationError("Invalid admin page limit", {
        adminCode: "VALIDATION_ERROR",
        limit,
      });
    }

    try {
      // Text search uses bounded scan (honest incomplete contract).
      if (filter?.q?.trim()) {
        return this.listAdminBoundedScan(filter, limit, cursor, sort);
      }

      let query: FirestoreQuery = this.col();
      if (filter?.status) {
        query = query.where("status", "==", filter.status);
      }
      if (filter?.sourceType) {
        query = query.where("sourceType", "==", filter.sourceType);
      }
      if (filter?.categoryId) {
        query = query.where("categoryIds", "array-contains", filter.categoryId);
      } else if (filter?.tagId) {
        query = query.where("tagIds", "array-contains", filter.tagId);
      } else if (filter?.audienceId) {
        query = query.where(
          "audienceIds",
          "array-contains",
          filter.audienceId,
        );
      }

      if (sort === "title_asc") {
        query = query.orderBy("title", "asc").orderBy("__name__", "asc");
      } else if (sort === "createdAt_desc") {
        query = query.orderBy("createdAt", "desc").orderBy("__name__", "desc");
      } else {
        query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");
      }

      if (cursor) {
        const decoded = decodePromptAdminCursor(cursor, sort);
        query = query.startAfter(decoded.v, decoded.id);
      }

      const snap = await query.limit(limit).get();
      const items = snap.docs.map((d) => fromPromptDoc(d.id, d.data()));
      const last = items[items.length - 1];
      const nextCursor =
        items.length === limit && last
          ? encodePromptAdminCursor({
              sort,
              v: sortValueForPrompt(last, sort),
              id: last.id,
            })
          : null;

      return { items, nextCursor, limit, scanLimitExceeded: false };
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new RepositoryError("Failed to list prompts for admin", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async listAdminBoundedScan(
    filter: PromptAdminListFilter,
    limit: number,
    cursor: string | null,
    sort: PromptAdminSort,
  ): Promise<PromptAdminPage> {
    const q = filter.q!.trim().toLowerCase();
    let query: FirestoreQuery = this.col();
    if (filter.status) {
      query = query.where("status", "==", filter.status);
    }
    if (filter.sourceType) {
      query = query.where("sourceType", "==", filter.sourceType);
    }
    query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");

    const snap = await query.limit(CONTENT_LIMITS.maxPromptAdminScan + 1).get();
    const scanLimitExceeded = snap.docs.length > CONTENT_LIMITS.maxPromptAdminScan;
    let items = snap.docs
      .slice(0, CONTENT_LIMITS.maxPromptAdminScan)
      .map((d) => fromPromptDoc(d.id, d.data()))
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q),
      );

    if (filter.categoryId) {
      items = items.filter((p) =>
        p.categoryIds.map(String).includes(filter.categoryId!),
      );
    }
    if (filter.tagId) {
      items = items.filter((p) => p.tagIds.map(String).includes(filter.tagId!));
    }
    if (filter.audienceId) {
      items = items.filter((p) =>
        p.audienceIds.map(String).includes(filter.audienceId!),
      );
    }

    items.sort((a, b) => comparePromptsAdmin(a, b, sort));

    let start = 0;
    if (cursor) {
      const decoded = decodePromptAdminCursor(cursor, sort);
      const idx = items.findIndex((i) => i.id === decoded.id);
      if (idx < 0) {
        throw new ValidationError("Malformed admin list cursor", {
          adminCode: "VALIDATION_ERROR",
        });
      }
      start = idx + 1;
    }
    const pageItems = items.slice(start, start + limit);
    const nextCursor =
      start + limit < items.length && pageItems.length > 0
        ? encodePromptAdminCursor({
            sort,
            v: sortValueForPrompt(pageItems[pageItems.length - 1]!, sort),
            id: pageItems[pageItems.length - 1]!.id,
          })
        : null;

    return {
      items: pageItems,
      nextCursor,
      limit,
      scanLimitExceeded,
    };
  }

  async findBySourceExternalId(input: {
    sourceType: SourceType;
    connectionId: string;
    externalId: string;
  }): Promise<Prompt | null> {
    try {
      const snap = await this.col()
        .where("sourceType", "==", input.sourceType)
        .where("sourceConnectionId", "==", input.connectionId)
        .where("sourceExternalId", "==", input.externalId)
        .limit(2)
        .get();
      if (snap.empty) return null;
      return fromPromptDoc(snap.docs[0]!.id, snap.docs[0]!.data());
    } catch (error) {
      throw new RepositoryError("Failed to find prompt by source external id", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
