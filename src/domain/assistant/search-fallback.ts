/**
 * Safe internal search fallback href for assistant refusals.
 * Always relative `/search…` via Search URL helper — never provider-supplied.
 */
export function assertSafeAssistantSearchHref(href: string): string | null {
  if (typeof href !== "string") return null;
  if (!href.startsWith("/search")) return null;
  if (href.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return null;
  if (href.includes("\\") || href.includes("\0")) return null;
  if (/[\u0000-\u001f\u007f]/.test(href)) return null;
  return href;
}
