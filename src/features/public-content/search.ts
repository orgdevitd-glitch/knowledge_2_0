import {
  PUBLIC_CONTENT_LIMITS,
  SEARCH_SCORE_WEIGHTS,
  type PublicMaterialType,
} from "./limits";
import type { SearchDocument, SearchHit } from "./read-models";

export function normalizeSearchQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function tokenize(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function containsToken(haystack: string, token: string): boolean {
  return normalizeSearchQuery(haystack).includes(token);
}

function scoreDocument(doc: SearchDocument, tokens: string[], raw: string): number {
  const titleNorm = normalizeSearchQuery(doc.title);
  let score = 0;

  if (titleNorm === raw) {
    score += SEARCH_SCORE_WEIGHTS.exactTitle;
  } else if (titleNorm.startsWith(raw)) {
    score += SEARCH_SCORE_WEIGHTS.titlePrefix;
  }

  for (const token of tokens) {
    if (containsToken(doc.title, token)) {
      score += SEARCH_SCORE_WEIGHTS.titleToken;
    }
    if (
      doc.categories.some((c) => containsToken(c, token)) ||
      doc.tags.some((t) => containsToken(t, token)) ||
      doc.audiences.some((a) => containsToken(a, token))
    ) {
      score += SEARCH_SCORE_WEIGHTS.taxonomyToken;
    }
    if (doc.summary && containsToken(doc.summary, token)) {
      score += SEARCH_SCORE_WEIGHTS.summaryToken;
    }
    if (doc.headings.some((h) => containsToken(h, token))) {
      score += SEARCH_SCORE_WEIGHTS.headingToken;
    }
    if (containsToken(doc.plainText, token)) {
      score += SEARCH_SCORE_WEIGHTS.bodyToken;
    }
  }

  return score;
}

export type SearchInput = {
  q: string;
  type?: string | null;
};

export type SearchResult = {
  query: string;
  normalizedQuery: string;
  hits: SearchHit[];
  tooShort: boolean;
  tooLong: boolean;
  type: PublicMaterialType | null;
};

export function runBasicSearch(
  documents: readonly SearchDocument[],
  input: SearchInput,
): SearchResult {
  const rawInput = input.q ?? "";
  const normalizedQuery = normalizeSearchQuery(rawInput);
  const type =
    input.type === "article" || input.type === "prompt" ? input.type : null;

  if (rawInput.length > PUBLIC_CONTENT_LIMITS.searchMaxQueryLength) {
    return {
      query: rawInput.slice(0, PUBLIC_CONTENT_LIMITS.searchMaxQueryLength),
      normalizedQuery,
      hits: [],
      tooShort: false,
      tooLong: true,
      type,
    };
  }

  if (normalizedQuery.length < PUBLIC_CONTENT_LIMITS.searchMinQueryLength) {
    return {
      query: rawInput,
      normalizedQuery,
      hits: [],
      tooShort: normalizedQuery.length > 0,
      tooLong: false,
      type,
    };
  }

  const tokens = tokenize(normalizedQuery);
  let pool = [...documents];
  if (type) {
    pool = pool.filter((d) => d.type === type);
  }

  const hits: SearchHit[] = [];
  for (const doc of pool) {
    const score = scoreDocument(doc, tokens, normalizedQuery);
    if (score <= 0) continue;
    hits.push({
      document: doc,
      score,
      titleMatches: tokens.filter((t) => containsToken(doc.title, t)),
    });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const updated = b.document.updatedAt.localeCompare(a.document.updatedAt);
    if (updated !== 0) return updated;
    return a.document.title.localeCompare(b.document.title, "ru");
  });

  return {
    query: rawInput,
    normalizedQuery,
    hits: hits.slice(0, PUBLIC_CONTENT_LIMITS.searchMaxResults),
    tooShort: false,
    tooLong: false,
    type,
  };
}

/** Safe highlight segments — no HTML injection. */
export function highlightSegments(
  text: string,
  tokens: string[],
): { text: string; match: boolean }[] {
  if (!tokens.length) {
    return [{ text, match: false }];
  }
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    const needle = token.toLowerCase();
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      ranges.push({ start: idx, end: idx + needle.length });
      from = idx + needle.length;
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (cursor < range.start) {
      parts.push({ text: text.slice(cursor, range.start), match: false });
    }
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }
  return parts;
}
