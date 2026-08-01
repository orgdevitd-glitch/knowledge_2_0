/**
 * Centralized Media Library limits (Phase 7B).
 * Environment overrides are applied via getMediaLimits() in config — do not
 * scatter magic numbers in UI or routes.
 */
export const MEDIA_KIND_VALUES = ["image", "document"] as const;
export type MediaKindValue = (typeof MEDIA_KIND_VALUES)[number];

export const MEDIA_STATUS_VALUES = [
  "uploading",
  "ready",
  "failed",
  "archived",
] as const;
export type MediaStatusValue = (typeof MEDIA_STATUS_VALUES)[number];

/** Default ceilings — overridable by env (see getMediaLimits). */
export const MEDIA_LIMIT_DEFAULTS = {
  imageMaxBytes: 5 * 1024 * 1024,
  documentMaxBytes: 15 * 1024 * 1024,
  signedUploadTtlSeconds: 15 * 60,
  /** Bytes read from object prefix for MIME sniffing. */
  sniffPrefixBytes: 64 * 1024,
  adminPageDefault: 20,
  adminPageMax: 50,
  maxAdminScan: 500,
  maxUsageScan: 2_000,
  originalFileNameMax: 200,
  descriptionMax: 1000,
  defaultAltTextMax: 500,
  failureReasonCodeMax: 64,
} as const;

export const MEDIA_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MEDIA_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
] as const;

export const MEDIA_ALLOWED_MIME_TYPES = [
  ...MEDIA_IMAGE_MIME_TYPES,
  ...MEDIA_DOCUMENT_MIME_TYPES,
] as const;

export type MediaAllowedMime = (typeof MEDIA_ALLOWED_MIME_TYPES)[number];

export const MEDIA_EXTENSION_BY_MIME: Record<MediaAllowedMime, readonly string[]> =
  {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "application/pdf": ["pdf"],
    "text/plain": ["txt"],
    "text/csv": ["csv"],
  };

export const MEDIA_MIME_BY_EXTENSION: Record<string, MediaAllowedMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
};

export function kindForMime(mime: MediaAllowedMime): MediaKindValue {
  if ((MEDIA_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
    return "image";
  }
  return "document";
}

export function maxBytesForKind(
  kind: MediaKindValue,
  limits: { imageMaxBytes: number; documentMaxBytes: number },
): number {
  return kind === "image" ? limits.imageMaxBytes : limits.documentMaxBytes;
}
