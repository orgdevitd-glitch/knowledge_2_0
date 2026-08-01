/**
 * TEST_ONLY / DEVELOPMENT DOMAIN EXPERIMENTS
 * Do not import from production UI, API routes, or server actions.
 * In-memory adapters are not a production persistence strategy.
 */
export const MEMORY_REPOSITORY_MARKER = "TEST_ONLY_IN_MEMORY" as const;

import {
  ConflictError,
  DuplicateSlugError,
} from "@/domain/shared/errors";
import type { ContentStatus } from "@/domain/shared/status";
import type {
  ContentListFilter,
  Page,
  PaginationInput,
  SaveOptions,
} from "../interfaces/types";
import { normalizePagination } from "../interfaces/types";

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

type Sluggable = {
  id: string;
  slug: string;
  revision: number;
  status: ContentStatus;
  updatedAt: string;
  createdAt: string;
  title: string;
  categoryIds?: readonly string[];
  tagIds?: readonly string[];
  audienceIds?: readonly string[];
};

export class MemoryEntityStore<T extends Sluggable> {
  private readonly byId = new Map<string, T>();

  getById(id: string): T | null {
    const item = this.byId.get(id);
    return item ? deepClone(item) : null;
  }

  getBySlug(slug: string): T | null {
    for (const item of this.byId.values()) {
      if (item.slug === slug) return deepClone(item);
    }
    return null;
  }

  existsBySlug(slug: string, excludeId?: string): boolean {
    for (const item of this.byId.values()) {
      if (item.slug === slug && item.id !== excludeId) return true;
    }
    return false;
  }

  /**
   * Optimistic concurrency:
   * - create: no row, expectedRevision must be 0
   * - update: existing.revision must equal expectedRevision
   * Caller passes the revision observed before the domain mutation.
   */
  save(entity: T, options: SaveOptions): T {
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

    if (this.existsBySlug(entity.slug, entity.id)) {
      throw new DuplicateSlugError("Slug already exists", {
        slug: entity.slug,
      });
    }

    this.byId.set(entity.id, deepClone(entity));
    return deepClone(entity);
  }

  list(
    filter: ContentListFilter | undefined,
    pagination: PaginationInput | undefined,
  ): Page<T> {
    const { limit, cursor } = normalizePagination(pagination);
    let items = [...this.byId.values()].map((i) => deepClone(i));

    if (filter?.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      items = items.filter((i) => statuses.includes(i.status));
    }
    if (filter?.categoryId) {
      items = items.filter((i) =>
        i.categoryIds?.includes(filter.categoryId as string),
      );
    }
    if (filter?.tagId) {
      items = items.filter((i) => i.tagIds?.includes(filter.tagId as string));
    }
    if (filter?.audienceId) {
      items = items.filter((i) =>
        i.audienceIds?.includes(filter.audienceId as string),
      );
    }

    const sort = filter?.sort ?? "updatedAt_desc";
    items.sort((a, b) => {
      switch (sort) {
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "updatedAt_asc":
          return a.updatedAt.localeCompare(b.updatedAt);
        case "createdAt_desc":
          return b.createdAt.localeCompare(a.createdAt);
        case "updatedAt_desc":
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });

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

    return { items: pageItems, nextCursor, limit };
  }

  clear(): void {
    this.byId.clear();
  }
}
