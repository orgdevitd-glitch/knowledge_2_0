import type { ActiveSearchDocument } from "@/domain/search/search-document";
import {
  SEARCH_SCORE_WEIGHTS_V2,
  type SearchEntityType,
} from "@/domain/search/search-limits";
import {
  normalizeSearchQuery,
  tokenizeSearchQuery,
} from "@/domain/search/text-normalize";
import type {
  RankedSearchCandidate,
  SearchQueryFilters,
} from "@/server/repositories/interfaces/search-index-port";

function containsToken(haystack: string, token: string): boolean {
  return normalizeSearchQuery(haystack).includes(token);
}

function freshnessBoost(publishedAt: string, nowMs: number): number {
  const publishedMs = Date.parse(publishedAt);
  if (!Number.isFinite(publishedMs)) return 0;
  const ageDays = Math.max(0, (nowMs - publishedMs) / (1000 * 60 * 60 * 24));
  // Small decay: full boost if < 7 days, none after ~180 days.
  const factor = Math.max(0, 1 - ageDays / 180);
  return SEARCH_SCORE_WEIGHTS_V2.freshnessMax * factor;
}

export function scoreActiveDocument(
  doc: ActiveSearchDocument,
  tokens: string[],
  normalizedQuery: string,
  /** Stable reference time for the generation (typically generation.createdAt). */
  referenceTimeMs: number,
): number {
  const titleNorm = normalizeSearchQuery(doc.title);
  let score = 0;

  if (titleNorm === normalizedQuery) {
    score += SEARCH_SCORE_WEIGHTS_V2.exactTitle;
  } else if (titleNorm.startsWith(normalizedQuery)) {
    score += SEARCH_SCORE_WEIGHTS_V2.titlePrefix;
  }

  for (const token of tokens) {
    if (containsToken(doc.title, token)) {
      score += SEARCH_SCORE_WEIGHTS_V2.titleToken;
    }
    if (doc.summary && containsToken(doc.summary, token)) {
      score += SEARCH_SCORE_WEIGHTS_V2.summaryToken;
    }
    if (doc.headings.some((h) => containsToken(h, token))) {
      score += SEARCH_SCORE_WEIGHTS_V2.headingToken;
    }
    if (containsToken(doc.bodyText, token) || containsToken(doc.searchableText, token)) {
      score += SEARCH_SCORE_WEIGHTS_V2.bodyToken;
    }
    if (doc.promptText && containsToken(doc.promptText, token)) {
      score += SEARCH_SCORE_WEIGHTS_V2.bodyToken;
    }
  }

  if (score > 0) {
    score += freshnessBoost(doc.publishedAt, referenceTimeMs);
  }
  return score;
}

export function matchesFilters(
  doc: ActiveSearchDocument,
  filters: SearchQueryFilters,
): boolean {
  if (filters.entityType && doc.entityType !== filters.entityType) return false;
  if (filters.categoryId && !doc.categoryIds.includes(filters.categoryId)) {
    return false;
  }
  if (filters.tagId && !doc.tagIds.includes(filters.tagId)) return false;
  if (filters.audienceId && !doc.audienceIds.includes(filters.audienceId)) {
    return false;
  }
  return true;
}

export function compareRankedCandidates(
  a: RankedSearchCandidate,
  b: RankedSearchCandidate,
): number {
  if (b.score !== a.score) return b.score - a.score;
  const byPub = b.document.publishedAt.localeCompare(a.document.publishedAt);
  if (byPub !== 0) return byPub;
  const byType = a.document.entityType.localeCompare(b.document.entityType);
  if (byType !== 0) return byType;
  return a.document.entityId.localeCompare(b.document.entityId);
}

export function rankActiveDocuments(
  documents: readonly ActiveSearchDocument[],
  q: string,
  filters: SearchQueryFilters,
  referenceTimeMs: number,
): RankedSearchCandidate[] {
  const normalizedQuery = normalizeSearchQuery(q);
  const tokens = tokenizeSearchQuery(normalizedQuery);
  if (!normalizedQuery || tokens.length === 0) return [];

  const hits: RankedSearchCandidate[] = [];
  for (const doc of documents) {
    if (!matchesFilters(doc, filters)) continue;
    const score = scoreActiveDocument(
      doc,
      tokens,
      normalizedQuery,
      referenceTimeMs,
    );
    if (score <= 0) continue;
    hits.push({ document: doc, score });
  }
  hits.sort(compareRankedCandidates);
  return hits;
}

export type { SearchEntityType };
