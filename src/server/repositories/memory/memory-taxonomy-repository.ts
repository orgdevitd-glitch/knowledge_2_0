import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import { assertTaxonomyTreeSize } from "@/domain/content/taxonomy";
import type {
  AudienceRepository,
  CategoryRepository,
  TagRepository,
} from "../interfaces/taxonomy-repository";
import type { PaginationInput, SaveOptions } from "../interfaces/types";
import { normalizePagination } from "../interfaces/types";
import {
  ConflictError,
  DuplicateSlugError,
} from "@/domain/shared/errors";
import { deepClone, MEMORY_REPOSITORY_MARKER } from "./memory-store";

class MemoryTaxonomyBase<
  T extends { id: string; slug: string; revision: number; title: string },
> {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  protected readonly byId = new Map<string, T>();

  getById(id: string) {
    const item = this.byId.get(id);
    return Promise.resolve(item ? deepClone(item) : null);
  }

  getBySlug(slug: string) {
    for (const item of this.byId.values()) {
      if (item.slug === slug) return Promise.resolve(deepClone(item));
    }
    return Promise.resolve(null);
  }

  existsBySlug(slug: string, excludeId?: string) {
    for (const item of this.byId.values()) {
      if (item.slug === slug && item.id !== excludeId) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  save(entity: T, options: SaveOptions) {
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
      );
    }
    for (const item of this.byId.values()) {
      if (item.slug === entity.slug && item.id !== entity.id) {
        throw new DuplicateSlugError("Slug already exists", {
          slug: entity.slug,
        });
      }
    }
    this.byId.set(entity.id, deepClone(entity));
    return Promise.resolve(deepClone(entity));
  }

  list(pagination?: PaginationInput) {
    const { limit, cursor } = normalizePagination(pagination);
    const items = [...this.byId.values()]
      .map((i) => deepClone(i))
      .sort((a, b) => a.title.localeCompare(b.title));
    let start = 0;
    if (cursor) {
      const idx = items.findIndex((i) => i.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const pageItems = items.slice(start, start + limit);
    const nextCursor =
      start + limit < items.length
        ? (pageItems[pageItems.length - 1]?.id ?? null)
        : null;
    return Promise.resolve({ items: pageItems, nextCursor, limit });
  }

  listAll() {
    const items = [...this.byId.values()]
      .map((i) => deepClone(i))
      .sort((a, b) => {
        const byTitle = a.title.localeCompare(b.title, "ru");
        if (byTitle !== 0) return byTitle;
        return a.id.localeCompare(b.id);
      });
    assertTaxonomyTreeSize(items.length);
    return Promise.resolve(items);
  }

  clear() {
    this.byId.clear();
  }
}

export class MemoryCategoryRepository
  extends MemoryTaxonomyBase<Category>
  implements CategoryRepository {}

export class MemoryTagRepository
  extends MemoryTaxonomyBase<Tag>
  implements TagRepository {}

export class MemoryAudienceRepository
  extends MemoryTaxonomyBase<Audience>
  implements AudienceRepository {}
