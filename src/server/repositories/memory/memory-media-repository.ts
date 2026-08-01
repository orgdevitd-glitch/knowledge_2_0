import type { MediaAsset } from "@/domain/content/media";
import { ConflictError, ValidationError } from "@/domain/shared/errors";
import { MEDIA_LIMIT_DEFAULTS } from "@/domain/shared/media-limits";
import type {
  MediaAdminListFilter,
  MediaAdminPage,
  MediaAdminSort,
  MediaRepository,
} from "../interfaces/media-repository";
import type { PaginationInput, SaveOptions } from "../interfaces/types";
import { normalizePagination } from "../interfaces/types";
import {
  compareMediaAdmin,
  decodeMediaAdminCursor,
  encodeMediaAdminCursor,
  sortValueForMedia,
} from "../media-admin-cursor";
import { deepClone, MEMORY_REPOSITORY_MARKER } from "./memory-store";

class MemoryMediaEntityStore {
  private readonly byId = new Map<string, MediaAsset>();

  getById(id: string): MediaAsset | null {
    const item = this.byId.get(id);
    return item ? deepClone(item) : null;
  }

  save(entity: MediaAsset, options: SaveOptions): MediaAsset {
    const existing = this.byId.get(entity.id);

    if (existing) {
      if (existing.revision !== options.expectedRevision) {
        throw new ConflictError("Optimistic concurrency conflict", {
          id: entity.id,
          expectedRevision: options.expectedRevision,
          actualRevision: existing.revision,
        });
      }
    } else if (options.expectedRevision !== 0) {
      throw new ConflictError(
        "Cannot create entity with non-zero expected revision",
        { expectedRevision: options.expectedRevision },
      );
    }

    this.byId.set(entity.id, deepClone(entity));
    return deepClone(entity);
  }

  replaceUnchecked(id: string, entity: MediaAsset | null): void {
    if (entity == null) {
      this.byId.delete(id);
      return;
    }
    this.byId.set(id, deepClone(entity));
  }

  all(): MediaAsset[] {
    return [...this.byId.values()].map((i) => deepClone(i));
  }

  clear(): void {
    this.byId.clear();
  }
}

export class MemoryMediaRepository implements MediaRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly store = new MemoryMediaEntityStore();

  getById(id: string) {
    return Promise.resolve(this.store.getById(id));
  }

  save(media: MediaAsset, options: SaveOptions) {
    return Promise.resolve(this.store.save(media, options));
  }

  async listAdmin(
    filter?: MediaAdminListFilter,
    pagination?: PaginationInput,
  ): Promise<MediaAdminPage> {
    const { limit, cursor } = normalizePagination({
      limit: pagination?.limit ?? MEDIA_LIMIT_DEFAULTS.adminPageDefault,
      cursor: pagination?.cursor,
    });
    if (limit > MEDIA_LIMIT_DEFAULTS.adminPageMax) {
      throw new ValidationError("Invalid admin page limit", {
        adminCode: "VALIDATION_ERROR",
        limit,
      });
    }

    const sort: MediaAdminSort = filter?.sort ?? "updatedAt_desc";
    let items = this.store.all().map((i) => deepClone(i));

    if (filter?.status) {
      items = items.filter((i) => i.status === filter.status);
    }
    if (filter?.kind) {
      items = items.filter((i) => i.kind === filter.kind);
    }

    let scanLimitExceeded = false;
    const q = filter?.q?.trim().toLowerCase();
    if (q) {
      items.sort((a, b) => compareMediaAdmin(a, b, sort));
      const scanCap = MEDIA_LIMIT_DEFAULTS.maxAdminScan;
      if (items.length > scanCap) {
        items = items.slice(0, scanCap);
        scanLimitExceeded = true;
      }
      items = items.filter(
        (i) =>
          String(i.title).toLowerCase().includes(q) ||
          i.originalFileName.toLowerCase().includes(q) ||
          String(i.title).toLowerCase().startsWith(q),
      );
    }

    items.sort((a, b) => compareMediaAdmin(a, b, sort));

    let start = 0;
    if (cursor) {
      const decoded = decodeMediaAdminCursor(cursor, sort);
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
        ? encodeMediaAdminCursor({
            sort,
            v: sortValueForMedia(pageItems[pageItems.length - 1]!, sort),
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

  /** TEST_ONLY rollback helper */
  replaceUnchecked(media: MediaAsset | null, id: string) {
    this.store.replaceUnchecked(id, media);
  }

  clear() {
    this.store.clear();
  }

  /** TEST_ONLY */
  size() {
    return this.store.all().length;
  }
}
