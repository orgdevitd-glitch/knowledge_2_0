import "server-only";

import type { Article } from "@/domain/content/article";
import {
  ConflictError,
  DuplicateSlugError,
  RepositoryError,
} from "@/domain/shared/errors";
import type { ArticleRepository } from "@/server/repositories/interfaces/article-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "@/server/repositories/interfaces/types";
import { normalizePagination } from "@/server/repositories/interfaces/types";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromArticleDoc, toArticleDoc } from "./mappers";

export class FirestoreArticleRepository implements ArticleRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(FIRESTORE_COLLECTIONS.articles);
  }

  async getById(id: string): Promise<Article | null> {
    try {
      const snap = await this.col().doc(id).get();
      if (!snap.exists) return null;
      return fromArticleDoc(snap.id, snap.data());
    } catch (error) {
      if (error instanceof ConflictError || error instanceof DuplicateSlugError) {
        throw error;
      }
      throw new RepositoryError("Failed to read article", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async getBySlug(slug: string): Promise<Article | null> {
    try {
      const snap = await this.col().where("slug", "==", slug).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0]!;
      return fromArticleDoc(doc.id, doc.data());
    } catch (error) {
      throw new RepositoryError("Failed to read article by slug", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.getBySlug(slug);
    if (!found) return false;
    return found.id !== excludeId;
  }

  async save(article: Article, options: SaveOptions): Promise<Article> {
    const db = getFirebaseAdminFirestore();
    const ref = this.col().doc(article.id);
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
          const existing = fromArticleDoc(current.id, current.data());
          if (existing.revision !== options.expectedRevision) {
            throw new ConflictError("Optimistic concurrency conflict", {
              expectedRevision: options.expectedRevision,
              actualRevision: existing.revision,
            });
          }
        }

        const slugQuery = this.col().where("slug", "==", article.slug).limit(5);
        const slugSnap = await tx.get(slugQuery);
        for (const doc of slugSnap.docs) {
          if (doc.id !== article.id) {
            throw new DuplicateSlugError("Slug already exists", {
              slug: article.slug,
            });
          }
        }

        tx.set(ref, toArticleDoc(article));
      });
      return structuredClone(article);
    } catch (error) {
      if (
        error instanceof ConflictError ||
        error instanceof DuplicateSlugError
      ) {
        throw error;
      }
      throw new RepositoryError("Failed to save article", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async list(
    filter?: ContentListFilter,
    pagination?: PaginationInput,
  ): Promise<{ items: Article[]; nextCursor: string | null; limit: number }> {
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
      let items = snap.docs.map((d) => fromArticleDoc(d.id, d.data()));

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
      throw new RepositoryError("Failed to list articles", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
