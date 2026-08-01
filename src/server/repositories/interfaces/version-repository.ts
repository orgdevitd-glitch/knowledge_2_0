import type { ContentVersion } from "@/domain/content/versioning";
import type { VersionEntityType } from "@/domain/content/versioning";

export interface VersionRepository {
  getById(id: string): Promise<ContentVersion | null>;
  listByEntity(
    entityType: VersionEntityType,
    entityId: string,
  ): Promise<ContentVersion[]>;
  getLatestByEntity(
    entityType: VersionEntityType,
    entityId: string,
  ): Promise<ContentVersion | null>;
  /** Immutable insert — never updates an existing version. */
  saveImmutable(version: ContentVersion): Promise<ContentVersion>;
}
