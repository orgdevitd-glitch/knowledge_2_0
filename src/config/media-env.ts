import "server-only";

import { MEDIA_LIMIT_DEFAULTS } from "@/domain/shared/media-limits";
import { getServerEnv } from "@/config/env";

export type MediaStorageMode = "memory" | "gcs";

/** Hard bounds for environment overrides (fail-closed). */
export const MEDIA_ENV_BOUNDS = {
  signedUploadTtlSecondsMin: 60,
  signedUploadTtlSecondsMax: 3_600,
  imageMaxBytesMin: 1_024,
  imageMaxBytesMax: 20 * 1024 * 1024,
  documentMaxBytesMin: 1_024,
  documentMaxBytesMax: 50 * 1024 * 1024,
} as const;

export type MediaLimitsConfig = {
  storageMode: MediaStorageMode;
  bucketName: string | null;
  signedUploadTtlSeconds: number;
  imageMaxBytes: number;
  documentMaxBytes: number;
  sniffPrefixBytes: number;
  maxUsageScan: number;
  maxAdminScan: number;
};

let cached: MediaLimitsConfig | null = null;

export function getMediaLimits(): MediaLimitsConfig {
  if (cached) return cached;
  const env = getServerEnv();
  const nodeEnv = env.NODE_ENV;

  const bucketName =
    process.env.MEDIA_GCS_BUCKET?.trim() ||
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    null;

  const storageMode = resolveStorageMode({
    nodeEnv,
    rawMode: process.env.MEDIA_STORAGE_MODE,
    bucketName,
    persistenceHint: process.env.PERSISTENCE_MODE ?? "",
  });

  if (storageMode === "gcs" && !bucketName) {
    throw new Error(
      "MEDIA_GCS_BUCKET or FIREBASE_STORAGE_BUCKET is required when MEDIA_STORAGE_MODE=gcs",
    );
  }

  const imageMaxBytes = parseBoundedInt(
    process.env.MEDIA_IMAGE_MAX_BYTES,
    MEDIA_LIMIT_DEFAULTS.imageMaxBytes,
    MEDIA_ENV_BOUNDS.imageMaxBytesMin,
    MEDIA_ENV_BOUNDS.imageMaxBytesMax,
    "MEDIA_IMAGE_MAX_BYTES",
  );
  const documentMaxBytes = parseBoundedInt(
    process.env.MEDIA_DOCUMENT_MAX_BYTES,
    MEDIA_LIMIT_DEFAULTS.documentMaxBytes,
    MEDIA_ENV_BOUNDS.documentMaxBytesMin,
    MEDIA_ENV_BOUNDS.documentMaxBytesMax,
    "MEDIA_DOCUMENT_MAX_BYTES",
  );
  const signedUploadTtlSeconds = parseBoundedInt(
    process.env.MEDIA_SIGNED_UPLOAD_TTL_SECONDS,
    MEDIA_LIMIT_DEFAULTS.signedUploadTtlSeconds,
    MEDIA_ENV_BOUNDS.signedUploadTtlSecondsMin,
    MEDIA_ENV_BOUNDS.signedUploadTtlSecondsMax,
    "MEDIA_SIGNED_UPLOAD_TTL_SECONDS",
  );

  cached = {
    storageMode,
    bucketName,
    signedUploadTtlSeconds,
    imageMaxBytes,
    documentMaxBytes,
    sniffPrefixBytes: MEDIA_LIMIT_DEFAULTS.sniffPrefixBytes,
    maxUsageScan: MEDIA_LIMIT_DEFAULTS.maxUsageScan,
    maxAdminScan: MEDIA_LIMIT_DEFAULTS.maxAdminScan,
  };
  return cached;
}

export function resolveStorageMode(input: {
  nodeEnv: "development" | "test" | "production";
  rawMode: string | undefined;
  bucketName: string | null;
  persistenceHint: string;
}): MediaStorageMode {
  const trimmed = input.rawMode?.trim() ?? "";

  if (input.nodeEnv === "production") {
    if (!trimmed) {
      throw new Error(
        "MEDIA_STORAGE_MODE is required in production (must be gcs)",
      );
    }
    if (trimmed === "memory") {
      throw new Error("MEDIA_STORAGE_MODE=memory is forbidden in production");
    }
    if (trimmed !== "gcs") {
      throw new Error(
        `Unknown MEDIA_STORAGE_MODE "${trimmed}" (allowed: gcs in production)`,
      );
    }
    return "gcs";
  }

  if (trimmed) {
    if (trimmed !== "gcs" && trimmed !== "memory") {
      throw new Error(
        `Unknown MEDIA_STORAGE_MODE "${trimmed}" (allowed: memory|gcs)`,
      );
    }
    return trimmed;
  }

  // Non-production default: memory in test / memory persistence / no bucket.
  if (
    input.nodeEnv === "test" ||
    input.persistenceHint === "memory" ||
    !input.bucketName
  ) {
    return "memory";
  }
  return "gcs";
}

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${name}: must be a positive integer`);
  }
  if (n < min || n > max) {
    throw new Error(`Invalid ${name}: must be between ${min} and ${max}`);
  }
  return n;
}

export function resetMediaEnvCacheForTests(): void {
  cached = null;
}
