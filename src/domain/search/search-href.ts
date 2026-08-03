import { CONTENT_LIMITS } from "@/domain/shared/limits";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Fail-closed validator for public SearchDocument / suggestion hrefs.
 * Allows only relative Article/Prompt material routes with a valid slug segment.
 * Does not throw; never logs the raw value (caller must not log either).
 */
export function isSafePublicSearchHref(href: unknown): boolean {
  if (typeof href !== "string") return false;
  if (!href) return false;
  // Reject absolute, protocol-relative, schemes, backslash, controls early.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return false;
  if (href.startsWith("//")) return false;
  if (href.includes("\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(href)) return false;
  if (href.includes("..")) return false;
  if (href.includes("%2e") || href.includes("%2E")) return false;
  if (href.includes("?") || href.includes("#")) return false;

  const match = /^\/(articles|prompts)\/([^/]+)$/.exec(href);
  if (!match) return false;
  const slug = match[2]!;
  if (!slug) return false;
  try {
    const decoded = decodeURIComponent(slug);
    if (decoded !== slug) {
      // Encoded forms are not part of the published href contract.
      return false;
    }
  } catch {
    return false;
  }
  if (slug.length < CONTENT_LIMITS.slug.min) return false;
  if (slug.length > CONTENT_LIMITS.slug.max) return false;
  if (!SLUG_RE.test(slug)) return false;
  return true;
}

/** Assert-style helper for generation validation (throws ValidationError via caller). */
export function assertSafePublicSearchHref(href: unknown): asserts href is string {
  if (!isSafePublicSearchHref(href)) {
    throw new Error("UNSAFE_SEARCH_HREF");
  }
}
