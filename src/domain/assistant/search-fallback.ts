/**
 * Safe internal search fallback href for assistant refusals.
 * Always a relative `/search` route with the public Search URL query contract.
 * Never provider-supplied; never an absolute or prefix-only `/search…` string.
 */

export const ASSISTANT_SEARCH_HREF_QUERY_KEYS = [
  "q",
  "type",
  "category",
  "tag",
  "audience",
  "cursor",
] as const;

const ALLOWED_QUERY_KEY_SET = new Set<string>(ASSISTANT_SEARCH_HREF_QUERY_KEYS);

/** Dummy origin used only to parse already-checked relative hrefs. Never emitted. */
const INTERNAL_PARSE_BASE = "https://knowledge.invalid";

const VALID_PERCENT = /%[0-9A-Fa-f]{2}/g;

function hasMalformedPercentEncoding(href: string): boolean {
  return href.replace(VALID_PERCENT, "").includes("%");
}

function isAllowedType(value: string): boolean {
  return value === "article" || value === "prompt";
}

/**
 * Fail-closed validator for assistant `searchHref`.
 * Returns a relative `/search` href or null. Does not throw. Does not log.
 */
export function assertSafeAssistantSearchHref(href: string): string | null {
  if (typeof href !== "string" || href.length === 0) return null;

  // Reject before any URL parsing so a dummy base cannot “rescue” an external URL.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return null;
  if (href.startsWith("//")) return null;
  if (href.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(href)) return null;
  if (!href.startsWith("/")) return null;
  if (href.includes("#")) return null;
  if (hasMalformedPercentEncoding(href)) return null;

  let url: URL;
  try {
    url = new URL(href, INTERNAL_PARSE_BASE);
  } catch {
    return null;
  }

  if (url.origin !== new URL(INTERNAL_PARSE_BASE).origin) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.pathname !== "/search") return null;
  if (url.hash !== "") return null;

  const params = url.searchParams;
  const keys = [...params.keys()];
  for (const key of keys) {
    if (!ALLOWED_QUERY_KEY_SET.has(key)) return null;
    if (params.getAll(key).length > 1) return null;
  }

  const type = params.get("type");
  if (type != null && type !== "" && !isAllowedType(type)) return null;

  const out = new URLSearchParams();
  for (const key of ASSISTANT_SEARCH_HREF_QUERY_KEYS) {
    const value = params.get(key);
    if (value == null || value === "") continue;
    out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `/search?${qs}` : "/search";
}
