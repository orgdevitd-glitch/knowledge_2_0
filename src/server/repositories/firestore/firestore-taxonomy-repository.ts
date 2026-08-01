import "server-only";

import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import { assertTaxonomyTreeSize } from "@/domain/content/taxonomy";
import {
  ConflictError,
  DuplicateSlugError,
  RepositoryError,
} from "@/domain/shared/errors";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import type {
  AudienceRepository,
  CategoryRepository,
  TagRepository,
} from "@/server/repositories/interfaces/taxonomy-repository";
import type {
  PaginationInput,
  SaveOptions,
} from "@/server/repositories/interfaces/types";
import { normalizePagination } from "@/server/repositories/interfaces/types";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import {
  fromAudienceDoc,
  fromCategoryDoc,
  fromTagDoc,
  toTaxonomyDoc,
} from "./mappers";

abstract class FirestoreTaxonomyBase<
  T extends { id: string; slug: string; revision: number; title: string },
> {
  protected abstract collectionName: string;
  protected abstract fromDoc(id: string, data: unknown): T;

  protected col() {
    return getFirebaseAdminFirestore().collection(this.collectionName);
  }

  async getById(id: string): Promise<T | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    return this.fromDoc(snap.id, snap.data());
  }

  async getBySlug(slug: string): Promise<T | null> {
    const snap = await this.col().where("slug", "==", slug).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    return this.fromDoc(doc.id, doc.data());
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.getBySlug(slug);
    if (!found) return false;
    return found.id !== excludeId;
  }

  async save(entity: T, options: SaveOptions): Promise<T> {
    const db = getFirebaseAdminFirestore();
    const ref = this.col().doc(entity.id);
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
          const existing = this.fromDoc(current.id, current.data());
          if (existing.revision !== options.expectedRevision) {
            throw new ConflictError("Optimistic concurrency conflict");
          }
        }
        const slugQuery = this.col().where("slug", "==", entity.slug).limit(5);
        const slugSnap = await tx.get(slugQuery);
        for (const doc of slugSnap.docs) {
          if (doc.id !== entity.id) {
            throw new DuplicateSlugError("Slug already exists", {
              slug: entity.slug,
            });
          }
        }
        tx.set(
          ref,
          toTaxonomyDoc(entity as unknown as Category | Tag | Audience),
        );
      });
      return structuredClone(entity);
    } catch (error) {
      if (
        error instanceof ConflictError ||
        error instanceof DuplicateSlugError
      ) {
        throw error;
      }
      throw new RepositoryError("Failed to save taxonomy entity", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async list(pagination?: PaginationInput) {
    const { limit, cursor } = normalizePagination(pagination);
    const snap = await this.col().orderBy("title", "asc").limit(200).get();
    const items = snap.docs.map((d) => this.fromDoc(d.id, d.data()));
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
  }

  async listAll(): Promise<T[]> {
    const max = CONTENT_LIMITS.maxTaxonomyTreeItems;
    const snap = await this.col()
      .orderBy("title", "asc")
      .limit(max + 1)
      .get();
    const items = snap.docs.map((d) => this.fromDoc(d.id, d.data()));
    assertTaxonomyTreeSize(items.length > max ? max + 1 : items.length);
    return items.sort((a, b) => {
      const byTitle = a.title.localeCompare(b.title, "ru");
      if (byTitle !== 0) return byTitle;
      return a.id.localeCompare(b.id);
    });
  }
}

export class FirestoreCategoryRepository
  extends FirestoreTaxonomyBase<Category>
  implements CategoryRepository
{
  protected collectionName = FIRESTORE_COLLECTIONS.categories;
  protected fromDoc(id: string, data: unknown) {
    return fromCategoryDoc(id, data);
  }
}

export class FirestoreTagRepository
  extends FirestoreTaxonomyBase<Tag>
  implements TagRepository
{
  protected collectionName = FIRESTORE_COLLECTIONS.tags;
  protected fromDoc(id: string, data: unknown) {
    return fromTagDoc(id, data);
  }
}

export class FirestoreAudienceRepository
  extends FirestoreTaxonomyBase<Audience>
  implements AudienceRepository
{
  protected collectionName = FIRESTORE_COLLECTIONS.audiences;
  protected fromDoc(id: string, data: unknown) {
    return fromAudienceDoc(id, data);
  }
}
