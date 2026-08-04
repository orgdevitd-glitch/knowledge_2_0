import { normalizeSearchText } from "@/domain/search/text-normalize";

/** Normalize assistant question text (Unicode, whitespace, control chars). */
export function normalizeAssistantQuestion(raw: string): string {
  return normalizeSearchText(raw);
}

/** Sanitize provider/answer plain text: no HTML intent, no control chars. */
export function sanitizeAssistantPlainText(raw: string): string {
  return normalizeSearchText(raw);
}

export function clampAssistantText(text: string, maxChars: number): string {
  const normalized = sanitizeAssistantPlainText(text);
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars);
}

/** Split oversized text on whitespace boundaries when possible. */
export function splitTextDeterministically(
  text: string,
  maxChars: number,
): string[] {
  const normalized = sanitizeAssistantPlainText(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const parts: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const breakAt = Math.max(
      window.lastIndexOf(" "),
      window.lastIndexOf("\n"),
      window.lastIndexOf("."),
      window.lastIndexOf(";"),
      window.lastIndexOf(","),
    );
    const cut = breakAt >= Math.floor(maxChars * 0.5) ? breakAt + 1 : maxChars;
    const piece = remaining.slice(0, cut).trim();
    if (piece) parts.push(piece);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
