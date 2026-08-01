import "server-only";

import {
  ConflictError,
  DuplicateSlugError,
  RepositoryError,
} from "@/domain/shared/errors";
import type {
  AtomicArticlePublishBundle,
  UnitOfWork,
} from "@/server/repositories/interfaces/unit-of-work";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromArticleDoc, toArticleDoc, toAuditDoc, toVersionDoc } from "./mappers";

export type { AtomicArticlePublishBundle };

/**
 * Firestore Unit of Work for atomic article publish (version + article + audit).
 * Transaction callbacks must not perform external side effects.
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
}
