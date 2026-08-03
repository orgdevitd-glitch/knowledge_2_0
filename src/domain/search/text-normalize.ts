import { SEARCH_LIMIT_DEFAULTS } from "./search-limits";

/** Strip C0 controls except tab/newline; normalize Unicode + whitespace. */
export function normalizeSearchText(raw: string): string {
  const nfkc = raw.normalize("NFKC");
  let cleaned = "";
  for (const ch of nfkc) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      cleaned += " ";
      continue;
    }
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      continue;
    }
    cleaned += ch;
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

export function normalizeSearchQuery(raw: string): string {
  return normalizeSearchText(raw).toLowerCase();
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function clampSearchableText(
  text: string,
  maxChars: number = SEARCH_LIMIT_DEFAULTS.maxDocumentCharacters,
): string {
  const normalized = normalizeSearchText(text);
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars);
}

export function buildSearchableBlob(parts: readonly (string | null | undefined)[]): string {
  return clampSearchableText(
    parts
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map((p) => normalizeSearchText(p))
      .join("\n"),
  );
}
