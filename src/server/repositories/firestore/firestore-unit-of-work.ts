import "server-only";

import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import {
  ConflictError,
  DuplicateSlugError,
  RepositoryError,
} from "@/domain/shared/errors";
import type {
  AtomicArticlePublishBundle,
  AtomicTaxonomyMutationBundle,
  UnitOfWork,
} from "@/server/repositories/interfaces/unit-of-work";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import {
  fromArticleDoc,
  fromAudienceDoc,
  fromCategoryDoc,
  fromTagDoc,
  toArticleDoc,
  toAuditDoc,
  toTaxonomyDoc,
  toVersionDoc,
} from "./mappers";

export type { AtomicArticlePublishBundle, AtomicTaxonomyMutationBundle };

function taxonomyCollection(kind: "category" | "tag" | "audience"): string {
  if (kind === "category") return FIRESTORE_COLLECTIONS.categories;
  if (kind === "tag") return FIRESTORE_COLLECTIONS.tags;
  return FIRESTORE_COLLECTIONS.audiences;
}

function fromTaxonomyDoc(
  kind: "category" | "tag" | "audience",
  id: string,
  data: unknown,
): { revision: number; slug: string; id: string } {
  if (kind === "category") return fromCategoryDoc(id, data);
  if (kind === "tag") return fromTagDoc(id, data);
  return fromAudienceDoc(id, data);
}

/**
 * Firestore Unit of Work for atomic article publish and taxonomy mutations.
 */
export class FirestoreUnitOfWork implements UnitOfWork {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }

  async runAtomicArticlePublish(
    bundle: AtomicArticlePublishBundle,
  ): Promise<void> {
    const db = getFirebaseAdminFirestore();
    const articleRef = db
      .collection(FIRESTORE_COLLECTIONS.articles)
      .doc(bundle.article.id);
    const versionRef = db
      .collection(FIRESTORE_COLLECTIONS.contentVersions)
      .doc(bundle.version.id);
    const auditRef = db
      .collection(FIRESTORE_COLLECTIONS.auditEvents)
      .doc(bundle.audit.id);

    try {
      await db.runTransaction(async (tx) => {
        const articleSnap = await tx.get(articleRef);
        const versionSnap = await tx.get(versionRef);
        const auditSnap = await tx.get(auditRef);

        if (!articleSnap.exists) {
          throw new ConflictError("Article not found for publish");
        }
        const existing = fromArticleDoc(articleSnap.id, articleSnap.data());
        if (existing.revision !== bundle.expectedRevision) {
          throw new ConflictError("Optimistic concurrency conflict", {
            expectedRevision: bundle.expectedRevision,
            actualRevision: existing.revision,
          });
        }
        if (versionSnap.exists) {
          throw new ConflictError("Version already exists");
        }
        if (auditSnap.exists) {
          throw new ConflictError("Audit event already exists");
        }

        const slugQuery = db
          .collection(FIRESTORE_COLLECTIONS.articles)
          .where("slug", "==", bundle.article.slug)
          .limit(5);
        const slugSnap = await tx.get(slugQuery);
        for (const doc of slugSnap.docs) {
          if (doc.id !== bundle.article.id) {
            throw new DuplicateSlugError("Slug already exists");
          }
        }

        tx.set(articleRef, toArticleDoc(bundle.article));
        tx.create(versionRef, toVersionDoc(bundle.version));
        tx.create(auditRef, toAuditDoc(bundle.audit));
      });
    } catch (error) {
      if (
        error instanceof ConflictError ||
        error instanceof DuplicateSlugError
      ) {
        throw error;
      }
      throw new RepositoryError("Atomic publish transaction failed", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async runAtomicTaxonomyMutation(
    bundle: AtomicTaxonomyMutationBundle,
  ): Promise<void> {
    if (bundle.writes.length === 0) {
      throw new RepositoryError("Atomic taxonomy mutation requires writes");
    }
    const db = getFirebaseAdminFirestore();
    const auditRef = db
      .collection(FIRESTORE_COLLECTIONS.auditEvents)
      .doc(bundle.audit.id);

    try {
      await db.runTransaction(async (tx) => {
        const auditSnap = await tx.get(auditRef);
        if (auditSnap.exists) {
          throw new ConflictError("Audit event already exists");
        }

        for (const write of bundle.writes) {
          const col = taxonomyCollection(write.kind);
          const ref = db.collection(col).doc(write.entity.id);
          const current = await tx.get(ref);
          if (!current.exists) {
            if (write.expectedRevision !== 0) {
              throw new ConflictError(
                "Cannot create entity with non-zero expected revision",
              );
            }
          } else {
            const existing = fromTaxonomyDoc(
              write.kind,
              current.id,
              current.data(),
            );
            if (existing.revision !== write.expectedRevision) {
              throw new ConflictError("Optimistic concurrency conflict", {
                expectedRevision: write.expectedRevision,
                actualRevision: existing.revision,
              });
            }
          }

          const slugQuery = db
            .collection(col)
            .where("slug", "==", write.entity.slug)
            .limit(5);
          const slugSnap = await tx.get(slugQuery);
          for (const doc of slugSnap.docs) {
            if (doc.id !== write.entity.id) {
              throw new DuplicateSlugError("Slug already exists", {
                slug: write.entity.slug,
              });
            }
          }
        }

        for (const write of bundle.writes) {
          const col = taxonomyCollection(write.kind);
          const ref = db.collection(col).doc(write.entity.id);
          tx.set(
            ref,
            toTaxonomyDoc(
              write.entity as Category | Tag | Audience,
            ),
          );
        }
        tx.create(auditRef, toAuditDoc(bundle.audit));
      });
    } catch (error) {
      if (
        error instanceof ConflictError ||
        error instanceof DuplicateSlugError
      ) {
        throw error;
      }
      throw new RepositoryError("Atomic taxonomy mutation failed", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
