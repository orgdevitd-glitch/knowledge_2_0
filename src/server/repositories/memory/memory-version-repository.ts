import type { ContentVersion } from "@/domain/content/versioning";
import type { VersionEntityType } from "@/domain/content/versioning";
import { ConflictError } from "@/domain/shared/errors";
import type { VersionRepository } from "../interfaces/version-repository";
import { deepClone, MEMORY_REPOSITORY_MARKER } from "./memory-store";

export class MemoryVersionRepository implements VersionRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly byId = new Map<string, ContentVersion>();

  getById(id: string) {
    const item = this.byId.get(id);
    return Promise.resolve(item ? deepClone(item) : null);
  }

  async listByEntity(entityType: VersionEntityType, entityId: string) {
    return [...this.byId.values()]
      .filter((v) => v.entityType === entityType && v.entityId === entityId)
      .map((v) => deepClone(v))
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async getLatestByEntity(entityType: VersionEntityType, entityId: string) {
    const list = await this.listByEntity(entityType, entityId);
    return list.length ? (list[list.length - 1] ?? null) : null;
  }

  saveImmutable(version: ContentVersion) {
    if (this.byId.has(version.id)) {
      return Promise.reject(
        new ConflictError("Version is immutable and already exists", {
          id: version.id,
        }),
      );
    }
    this.byId.set(version.id, deepClone(version));
    return Promise.resolve(deepClone(version));
  }

  clear() {
    this.byId.clear();
  }
}
