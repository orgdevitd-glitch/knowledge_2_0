import "server-only";

import type { SearchIndexFailure } from "@/server/repositories/interfaces/search-index-failure-repository";
import type { SearchIndexFailureRepository } from "@/server/repositories/interfaces/search-index-failure-repository";
import { RepositoryError } from "@/domain/shared/errors";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import {
  fromSearchIndexFailureDoc,
  toSearchIndexFailureDoc,
} from "./mappers";

export class FirestoreSearchIndexFailureRepository
  implements SearchIndexFailureRepository
{
  async getById(id: string): Promise<SearchIndexFailure | null> {
    try {
      const snap = await getFirebaseAdminFirestore()
        .collection(FIRESTORE_COLLECTIONS.searchIndexFailures)
        .doc(id)
        .get();
      if (!snap.exists) return null;
      return fromSearchIndexFailureDoc(snap.id, snap.data());
    } catch (error) {
      throw new RepositoryError("Failed to read search index failure", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async save(failure: SearchIndexFailure): Promise<void> {
    try {
      await getFirebaseAdminFirestore()
        .collection(FIRESTORE_COLLECTIONS.searchIndexFailures)
        .doc(failure.id)
        .set(toSearchIndexFailureDoc(failure));
    } catch (error) {
      throw new RepositoryError("Failed to save search index failure", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listUnresolved(limit: number): Promise<SearchIndexFailure[]> {
    try {
      const snap = await getFirebaseAdminFirestore()
        .collection(FIRESTORE_COLLECTIONS.searchIndexFailures)
        .where("resolvedAt", "==", null)
        .orderBy("occurredAt", "desc")
        .limit(Math.min(Math.max(limit, 1), 100))
        .get();
      return snap.docs.map((d) => fromSearchIndexFailureDoc(d.id, d.data()));
    } catch (error) {
      throw new RepositoryError("Failed to list search index failures", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async findOpenForEntity(
    entityType: "article" | "prompt",
    entityId: string,
  ): Promise<SearchIndexFailure | null> {
    const open = await this.listOpenForEntity(entityType, entityId);
    return open[0] ?? null;
  }

  async listOpenForEntity(
    entityType: "article" | "prompt",
    entityId: string,
  ): Promise<SearchIndexFailure[]> {
    try {
      const snap = await getFirebaseAdminFirestore()
        .collection(FIRESTORE_COLLECTIONS.searchIndexFailures)
        .where("entityType", "==", entityType)
        .where("entityId", "==", entityId)
        .where("resolvedAt", "==", null)
        .orderBy("occurredAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => fromSearchIndexFailureDoc(d.id, d.data()));
    } catch (error) {
      throw new RepositoryError("Failed to find search index failure", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
