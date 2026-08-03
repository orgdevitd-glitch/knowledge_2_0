import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { highlightSegments } from "@/features/public-content/search";

export type SnippetSource = {
  title: string;
  summary: string | null;
  bodyText?: string | null;
  promptText?: string | null;
};

/**
 * Prefer a clipped field that actually highlights a token match.
 * Priority: matched snippet (summary → body → prompt → title) → summary → clipped fallback.
 */
export function pickHighlightedSnippet(
  doc: SnippetSource,
  tokens: string[],
): { text: string; match: boolean }[] {
  const max = SEARCH_LIMIT_DEFAULTS.snippetMaxLength;
  const candidates = [
    doc.summary,
    doc.bodyText,
    doc.promptText,
    doc.title,
  ].filter((p): p is string => typeof p === "string" && p.trim().length > 0);

  let fallback: { text: string; match: boolean }[] | null = null;
  for (const source of candidates) {
    const clipped = source.slice(0, max);
    const segments = highlightSegments(clipped, tokens);
    if (segments.some((s) => s.match)) return segments;
    if (!fallback) fallback = segments;
  }
  return fallback ?? [{ text: doc.title.slice(0, max), match: false }];
}
