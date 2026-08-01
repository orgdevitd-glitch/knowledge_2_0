import type { Prompt } from "@/domain/content/prompt";
import { ValidationError } from "@/domain/shared/errors";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import type {
  PromptAdminListFilter,
  PromptAdminPage,
  PromptAdminSort,
  PromptRepository,
} from "../interfaces/prompt-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "../interfaces/types";
import { normalizePagination } from "../interfaces/types";
import {
  comparePromptsAdmin,
  decodePromptAdminCursor,
  encodePromptAdminCursor,
  sortValueForPrompt,
} from "../prompt-admin-cursor";
import { MemoryEntityStore, MEMORY_REPOSITORY_MARKER, deepClone } from "./memory-store";

function assertSingleTaxonomyFilter(filter: PromptAdminListFilter | undefined) {
  const count = [filter?.categoryId, filter?.tagId, filter?.audienceId].filter(
    Boolean,
  ).length;
  if (count > 1) {
    throw new ValidationError(
      "Only one taxonomy filter (category, tag, or audience) is supported per query",
      { adminCode: "VALIDATION_ERROR" },
    );
  }
}

export class MemoryPromptRepository implements PromptRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly store = new MemoryEntityStore<Prompt>();

  getById(id: string) {
    return Promise.resolve(this.store.getById(id));
  }

  getBySlug(slug: string) {
    return Promise.resolve(this.store.getBySlug(slug));
  }

  existsBySlug(slug: string, excludeId?: string) {
    return Promise.resolve(this.store.existsBySlug(slug, excludeId));
  }

  save(prompt: Prompt, options: SaveOptions) {
    return Promise.resolve(this.store.save(prompt, options));
  }

  list(filter?: ContentListFilter, pagination?: PaginationInput) {
    return Promise.resolve(this.store.list(filter, pagination));
  }

  async listAdmin(
    filter?: PromptAdminListFilter,
    pagination?: PaginationInput,
  ): Promise<PromptAdminPage> {
    assertSingleTaxonomyFilter(filter);
    const { limit, cursor } = normalizePagination({
      limit: pagination?.limit ?? CONTENT_LIMITS.adminPromptPageDefault,
      cursor: pagination?.cursor,
    });
    if (limit > CONTENT_LIMITS.adminPromptPageMax) {
      throw new ValidationError("Invalid admin page limit", {
        adminCode: "VALIDATION_ERROR",
        limit,
      });
    }

    const sort: PromptAdminSort = filter?.sort ?? "updatedAt_desc";
    let items = this.store.all().map((i) => deepClone(i));

    if (filter?.status) {
      items = items.filter((i) => i.status === filter.status);
    }
    if (filter?.sourceType) {
      items = items.filter((i) => i.source.type === filter.sourceType);
    }
    if (filter?.categoryId) {
      items = items.filter((i) =>
        i.categoryIds.map(String).includes(filter.categoryId!),
      );
    }
    if (filter?.tagId) {
      items = items.filter((i) => i.tagIds.map(String).includes(filter.tagId!));
    }
    if (filter?.audienceId) {
      items = items.filter((i) =>
        i.audienceIds.map(String).includes(filter.audienceId!),
      );
    }

    let scanLimitExceeded = false;
    const q = filter?.q?.trim().toLowerCase();
    if (q) {
      items.sort((a, b) => comparePromptsAdmin(a, b, sort));
      const scanCap = CONTENT_LIMITS.maxPromptAdminScan;
      if (items.length > scanCap) {
        items = items.slice(0, scanCap);
        scanLimitExceeded = true;
      }
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q) ||
          i.title.toLowerCase().startsWith(q),
      );
    }

    items.sort((a, b) => comparePromptsAdmin(a, b, sort));

    let start = 0;
    if (cursor) {
      const decoded = decodePromptAdminCursor(cursor, sort);
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
        ? encodePromptAdminCursor({
            sort,
            v: sortValueForPrompt(pageItems[pageItems.length - 1]!, sort),
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

  async findBySourceExternalId(input: {
    sourceType: import("@/domain/content/source").SourceType;
    connectionId: string;
    externalId: string;
  }): Promise<Prompt | null> {
    for (const prompt of this.store.all()) {
      if (
        prompt.source.type === input.sourceType &&
        prompt.source.connectionId === input.connectionId &&
        prompt.source.externalId === input.externalId
      ) {
        return deepClone(prompt);
      }
    }
    return null;
  }

  /** TEST_ONLY rollback helper */
  replaceUnchecked(prompt: Prompt | null, id: string) {
    this.store.replaceUnchecked(id, prompt);
  }

  clear() {
    this.store.clear();
  }

  /** TEST_ONLY */
  size() {
    return this.store.all().length;
  }
}
