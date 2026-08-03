/**
 * One-shot intent flag so focus/scroll to #search-results only runs after
 * explicit search UX actions (submit, next page, cursor-reset CTA), not on
 * shared URL open or browser Back/Forward alone.
 */
const KEY = "ckp-search-focus-intent";

export function markSearchFocusIntent(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // sessionStorage may be unavailable — focus becomes a no-op.
  }
}

export function consumeSearchFocusIntent(): boolean {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
