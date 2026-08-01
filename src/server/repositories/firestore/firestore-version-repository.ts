import "server-only";

import type { ContentVersion } from "@/domain/content/versioning";
import type { VersionEntityType } from "@/domain/content/versioning";
import { ConflictError, RepositoryError } from "@/domain/shared/errors";
import type { VersionRepository } from "@/server/repositories/interfaces/version-repository";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromVersionDoc, toVersionDoc } from "./mappers";

export class FirestoreVersionRepository implements VersionRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(
      FIRESTORE_COLLECTIONS.contentVersions,
    );
  }

  async getById(id: string): Promise<ContentVersion | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    return fromVersionDoc(snap.id, snap.data());
  }

  async listByEntity(
    entityType: VersionEntityType,
    entityId: string,
  ): Promise<ContentVersion[]> {
    const snap = await this.col()
      .where("entityType", "==", entityType)
      .where("entityId", "==", entityId)
      .limit(100)
      .get();
    return snap.docs
      .map((d) => fromVersionDoc(d.id, d.data()))
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async getLatestByEntity(
    entityType: VersionEntityType,
    entityId: string,
  ): Promise<ContentVersion | null> {
    const list = await this.listByEntity(entityType, entityId);
    return list.length ? (list[list.length - 1] ?? null) : null;
  }

  async saveImmutable(version: ContentVersion): Promise<ContentVersion> {
    const ref = this.col().doc(version.id);
    try {
      const existing = await ref.get();
      if (existing.exists) {
        throw new ConflictError("Version is immutable and already exists", {
          id: version.id,
        });
      }
      await ref.create(toVersionDoc(version));
      return structuredClone(version);
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw new RepositoryError("Failed to save version", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
