import "server-only";

import type { Prompt } from "@/domain/content/prompt";
import {
  ConflictError,
  DuplicateSlugError,
  RepositoryError,
} from "@/domain/shared/errors";
import type { PromptRepository } from "@/server/repositories/interfaces/prompt-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "@/server/repositories/interfaces/types";
import { normalizePagination } from "@/server/repositories/interfaces/types";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromPromptDoc, toPromptDoc } from "./mappers";

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
}
