/**
 * Bounded admin picker limits (Phase 8E.1).
 * Title substring filter over a capped admin list — not a full-text index.
 */
export const PICKER_QUERY_MAX_LENGTH = 80;
export const PICKER_RESULT_LIMIT = 20;
export const PICKER_LOOKUP_MAX = 20;
/** Max documents scanned when the article repository has no native `q`. */
export const PICKER_ARTICLE_SCAN_LIMIT = 100;
export const PICKER_SEARCH_DEBOUNCE_MS = 300;
/** Short summary for picker rows — not full draft body. */
export const PICKER_SUMMARY_MAX = 180;
export const PICKER_CACHE_CONTROL = "private, no-store";

export const PICKER_MEDIA_ITEM_KEYS = [
  "id",
  "title",
  "kind",
  "status",
  "originalFileName",
  "publicPath",
  "selectable",
  "unavailable",
] as const;

export const PICKER_MATERIAL_ITEM_KEYS = [
  "id",
  "title",
  "entityType",
  "status",
  "summary",
  "selectable",
  "unavailable",
] as const;

export function clampPickerQuery(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, PICKER_QUERY_MAX_LENGTH);
}

export function parsePickerIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || id.length > 128 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= PICKER_LOOKUP_MAX) break;
  }
  return ids;
}

export function parsePickerLimit(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw ?? PICKER_RESULT_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) return PICKER_RESULT_LIMIT;
  return Math.min(n, PICKER_RESULT_LIMIT);
}

export function parsePickerExcludeId(raw: string | null | undefined): string | undefined {
  return parsePickerIds(raw)[0];
}

export function clampPickerSummary(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, PICKER_SUMMARY_MAX);
}
