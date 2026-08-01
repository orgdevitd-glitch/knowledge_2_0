import {
  kindForMime,
  MEDIA_EXTENSION_BY_MIME,
  MEDIA_MIME_BY_EXTENSION,
  type MediaAllowedMime,
  type MediaKindValue,
} from "../shared/media-limits";

export type MediaSniffResult =
  | {
      ok: true;
      mimeType: MediaAllowedMime;
      kind: MediaKindValue;
    }
  | {
      ok: false;
      failureReasonCode: string;
    };

function startsWith(buf: Uint8Array, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function detectBinarySignature(buf: Uint8Array): MediaAllowedMime | null {
  // JPEG
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG
  if (
    startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // PDF: %PDF
  if (
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return "application/pdf";
  }
  return null;
}

function isMostlyText(buf: Uint8Array): boolean {
  if (buf.length === 0) return true;
  let suspicious = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const c = buf[i]!;
    if (c === 0) return false; // NUL
    // Allow common whitespace + printable ASCII + high UTF-8 bytes
    const ok =
      c === 0x09 ||
      c === 0x0a ||
      c === 0x0d ||
      (c >= 0x20 && c <= 0x7e) ||
      c >= 0x80;
    if (!ok) suspicious += 1;
  }
  return suspicious / buf.length <= 0.02;
}

/**
 * Detect content type from object prefix. Client MIME is ignored.
 * For text/csv and text/plain, extension must already match declared kind.
 */
export function sniffMediaContent(input: {
  prefix: Uint8Array;
  fileExtension: string;
  expectedKind: MediaKindValue;
}): MediaSniffResult {
  const ext = input.fileExtension.toLowerCase().replace(/^\./, "");
  const binaryMime = detectBinarySignature(input.prefix);

  if (binaryMime) {
    const allowedExts = MEDIA_EXTENSION_BY_MIME[binaryMime];
    if (!allowedExts.includes(ext)) {
      return { ok: false, failureReasonCode: "EXTENSION_MIME_MISMATCH" };
    }
    const kind = kindForMime(binaryMime);
    if (kind !== input.expectedKind) {
      return { ok: false, failureReasonCode: "KIND_MIME_MISMATCH" };
    }
    return { ok: true, mimeType: binaryMime, kind };
  }

  // Text paths: only when extension maps to text types
  const mapped = MEDIA_MIME_BY_EXTENSION[ext];
  if (!mapped || (mapped !== "text/plain" && mapped !== "text/csv")) {
    return { ok: false, failureReasonCode: "UNSUPPORTED_CONTENT_TYPE" };
  }
  if (kindForMime(mapped) !== input.expectedKind) {
    return { ok: false, failureReasonCode: "KIND_MIME_MISMATCH" };
  }
  if (!isMostlyText(input.prefix)) {
    return { ok: false, failureReasonCode: "BINARY_DISGUISED_AS_TEXT" };
  }
  return { ok: true, mimeType: mapped, kind: input.expectedKind };
}

/** Sanitize original filename for display metadata only (never for storage paths). */
export function sanitizeOriginalFileName(
  raw: string,
  maxLen: number,
): string {
  const base = raw
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    return "file";
  }
  return cleaned.slice(0, maxLen);
}

export function extractFileExtension(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

export function assertSafeStorageKeySegment(segment: string): void {
  if (
    !segment ||
    segment.includes("..") ||
    segment.includes("/") ||
    segment.includes("\\") ||
    segment.includes("\0")
  ) {
    throw new Error("Invalid storage key segment");
  }
}
