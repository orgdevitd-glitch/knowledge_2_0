import "server-only";

import { getSearchLimits } from "@/config/search-env";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import {
  normalizeSearchQuery,
  tokenizeSearchQuery,
} from "@/domain/search/text-normalize";
import { RepositoryError, ValidationError } from "@/domain/shared/errors";
import { highlightSegments } from "@/features/public-content/search";
import type { SearchQueryFilters } from "@/server/repositories/interfaces/search-index-port";
import {
  encodeSearchCursor,
  decodeSearchCursor,
  hashSearchFilters,
  hashSearchQuery,
} from "@/server/search/search-cursor";
import {
  getPublicSearchVisibility,
  getSearchIndex,
} from "@/server/composition/search-ports";

export type PublicSearchItemDto = {
  entityType: "article" | "prompt";
  entityId: string;
  title: string;
  summary: string | null;
  snippet: { text: string; match: boolean }[];
  href: string;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  publishedAt: string;
};

export type PublicSearchResponse = {
  items: PublicSearchItemDto[];
  nextCursor: string | null;
  generationId: string | null;
  totalApproximate: number | null;
  filtersApplied: SearchQueryFilters;
  incompleteScan: boolean;
  tooShort: boolean;
  tooLong: boolean;
  emptyQuery: boolean;
};

/**
 * nextCursor is always based on the last *scanned* candidate position
 * (not the last returned item), so stale/hidden hits are not re-scanned.
 */
export async function executePublicSearch(input: {
  q: string;
  type?: string | null;
  category?: string | null;
  tag?: string | null;
  audience?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<PublicSearchResponse> {
  const limits = getSearchLimits();
  const rawQ = input.q ?? "";
  const filters: SearchQueryFilters = {
    entityType:
      input.type === "article" || input.type === "prompt" ? input.type : null,
    categoryId: input.category?.trim() || null,
    tagId: input.tag?.trim() || null,
    audienceId: input.audience?.trim() || null,
  };

  const empty = (extra: Partial<PublicSearchResponse> = {}): PublicSearchResponse => ({
    items: [],
    nextCursor: null,
    generationId: null,
    totalApproximate: null,
    filtersApplied: filters,
    incompleteScan: false,
    tooShort: false,
    tooLong: false,
    emptyQuery: false,
    ...extra,
  });

  if (!rawQ.trim()) {
    return empty({ emptyQuery: true });
  }
  if (rawQ.length > limits.queryMaxLength) {
    return empty({ tooLong: true });
  }
  const normalized = normalizeSearchQuery(rawQ);
  if (normalized.length < SEARCH_LIMIT_DEFAULTS.queryMinLength) {
    return empty({ tooShort: true });
  }

  const limit = Math.min(
    Math.max(input.limit ?? limits.pageDefaultSize, 1),
    limits.pageMaxSize,
  );

  let after: {
    score: number;
    publishedAt: string;
    entityType: "article" | "prompt";
    entityId: string;
  } | null = null;
  let generationId: string | null = null;
  const qHash = hashSearchQuery(rawQ);
  const fHash = hashSearchFilters(filters);

  if (input.cursor) {
    const payload = decodeSearchCursor(input.cursor);
    if (payload.queryHash !== qHash || payload.filtersHash !== fHash) {
      throw new ValidationError("Search cursor does not match query", {
        adminCode: "SEARCH_CURSOR_INVALID",
      });
    }
    generationId = payload.generationId;
    after = {
      score: payload.score,
      publishedAt: payload.publishedAt,
      entityType: payload.entityType,
      entityId: payload.entityId,
    };
  }

  const index = getSearchIndex();
  const visibility = getPublicSearchVisibility();
  const overfetch = limit * limits.visibilityOverfetchFactor;
  const tokens = tokenizeSearchQuery(normalized);

  const items: PublicSearchItemDto[] = [];
  let scanCount = 0;
  let incompleteScan = false;
  let indexHasMore = false;
  let lastScanned: {
    score: number;
    publishedAt: string;
    entityType: "article" | "prompt";
    entityId: string;
  } | null = after;
  let pageGenerationId = generationId ?? "";

  try {
    while (items.length < limit && scanCount < limits.visibilityMaxScan) {
      const batchLimit = Math.min(
        overfetch,
        limits.visibilityMaxScan - scanCount,
      );
      const page = await index.search({
        q: rawQ,
        filters,
        limit: batchLimit,
        after: lastScanned,
        generationId,
      });
      pageGenerationId = page.generationId;
      if (!page.generationId) break;
      if (generationId && page.generationId !== generationId) {
        throw new ValidationError("Search generation expired", {
          adminCode: "SEARCH_CURSOR_EXPIRED",
        });
      }
      generationId = page.generationId;
      indexHasMore = page.hasMore;

      if (!page.candidates.length) break;

      const visibilityResults = await visibility.filterVisible(
        page.candidates.map((c) => ({
          entityType: c.document.entityType,
          entityId: c.document.entityId,
          versionId: c.document.versionId,
        })),
      );
      const visibleSet = new Set(
        visibilityResults
          .filter((v) => v.visible)
          .map((v) => `${v.entityType}:${v.entityId}`),
      );

      for (const candidate of page.candidates) {
        scanCount += 1;
        lastScanned = {
          score: candidate.score,
          publishedAt: candidate.document.publishedAt,
          entityType: candidate.document.entityType,
          entityId: candidate.document.entityId,
        };
        const key = `${candidate.document.entityType}:${candidate.document.entityId}`;
        if (!visibleSet.has(key)) continue;

        const snippetSource =
          candidate.document.summary ||
          candidate.document.bodyText ||
          candidate.document.promptText ||
          candidate.document.title;
        const clipped = snippetSource.slice(
          0,
          SEARCH_LIMIT_DEFAULTS.snippetMaxLength,
        );
        items.push({
          entityType: candidate.document.entityType,
          entityId: candidate.document.entityId,
          title: candidate.document.title,
          summary: candidate.document.summary,
          snippet: highlightSegments(clipped, tokens),
          href: candidate.document.href,
          categoryIds: candidate.document.categoryIds,
          tagIds: candidate.document.tagIds,
          audienceIds: candidate.document.audienceIds,
          publishedAt: candidate.document.publishedAt,
        });
        if (items.length >= limit) break;
      }

      if (!page.hasMore) break;
      if (scanCount >= limits.visibilityMaxScan && items.length < limit) {
        incompleteScan = true;
        break;
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (
      error instanceof RepositoryError &&
      ((error.details as { adminCode?: string } | undefined)?.adminCode ===
        "SEARCH_INDEX_UNAVAILABLE" ||
        (error.details as { adminCode?: string } | undefined)?.adminCode ===
          "SEARCH_INDEX_CORRUPT")
    ) {
      throw error;
    }
    throw new RepositoryError("Search temporarily unavailable", {
      adminCode: "SEARCH_INDEX_UNAVAILABLE",
    });
  }

  let nextCursor: string | null = null;
  const shouldEmitCursor =
    Boolean(lastScanned) &&
    Boolean(pageGenerationId) &&
    (items.length >= limit || incompleteScan || (indexHasMore && scanCount > 0));
  if (shouldEmitCursor && lastScanned) {
    nextCursor = encodeSearchCursor({
      schemaVersion: 1,
      generationId: pageGenerationId,
      queryHash: qHash,
      filtersHash: fHash,
      score: lastScanned.score,
      publishedAt: lastScanned.publishedAt,
      entityType: lastScanned.entityType,
      entityId: lastScanned.entityId,
    });
  }

  return {
    items,
    nextCursor,
    generationId: pageGenerationId || null,
    totalApproximate: null,
    filtersApplied: filters,
    incompleteScan,
    tooShort: false,
    tooLong: false,
    emptyQuery: false,
  };
}
