/**
 * Plain-text answer block safety for Phase 8C.1.
 * Rejects HTML, Markdown links/images, URL schemes, and fake citation markers.
 *
 * Allowed: ordinary punctuation, numbered lists like "1. Step", and brackets
 * that are NOT a lone citation marker `[n]` (server citations use citationNumbers).
 */

const URL_LIKE =
  /https?:\/\/|www\.|mailto:|javascript:|data:|file:|vbscript:/i;

const PROTOCOL_RELATIVE = /(?:^|[\s(])\/\//;

const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;

const MARKDOWN_LINK = /\[[^\]]*\]\([^)]+\)/;

const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]+\)/;

/** Lone bracket citation marker that could impersonate server citations. */
const FAKE_CITATION_MARKER = /(?:^|[^\w[])\[(\d+)\](?!\()/;

export type PlainTextSafetyResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export function assertSafeAssistantPlainText(
  raw: string,
): PlainTextSafetyResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "not_string" };
  }
  if (URL_LIKE.test(raw)) {
    return { ok: false, reason: "url_scheme" };
  }
  if (PROTOCOL_RELATIVE.test(raw)) {
    return { ok: false, reason: "protocol_relative" };
  }
  if (HTML_TAG.test(raw)) {
    return { ok: false, reason: "html" };
  }
  if (MARKDOWN_IMAGE.test(raw)) {
    return { ok: false, reason: "markdown_image" };
  }
  if (MARKDOWN_LINK.test(raw)) {
    return { ok: false, reason: "markdown_link" };
  }
  if (FAKE_CITATION_MARKER.test(raw)) {
    return { ok: false, reason: "fake_citation_marker" };
  }
  return { ok: true, text: raw };
}
