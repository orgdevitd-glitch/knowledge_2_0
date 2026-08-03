import "server-only";

import {
  SEARCH_ENV_BOUNDS,
  SEARCH_LIMIT_DEFAULTS,
} from "@/domain/search/search-limits";
import { assertSearchIndexPrefix } from "@/domain/search/search-index-validation";
import { getServerEnv } from "@/config/env";

export type SearchIndexMode = "memory" | "gcs";

export type SearchLimitsConfig = {
  indexMode: SearchIndexMode;
  bucketName: string | null;
  indexPrefix: string;
  cacheTtlSeconds: number;
  generationCacheTtlSeconds: number;
  queryMaxLength: number;
  pageMaxSize: number;
  pageDefaultSize: number;
  maxDocuments: number;
  maxIndexBytes: number;
  maxDocumentCharacters: number;
  casMaxRetries: number;
  visibilityOverfetchFactor: number;
  visibilityMaxScan: number;
  visibilityBatchSize: number;
  rebuildPageSize: number;
  rebuildMaxPages: number;
  cursorHmacSecret: string;
};

let cached: SearchLimitsConfig | null = null;

/**
 * Bucket selection: SEARCH_INDEX_BUCKET is required for gcs.
 * Reusing the media bucket is allowed only by setting SEARCH_INDEX_BUCKET
 * explicitly to that same value — never a silent MEDIA_GCS_BUCKET fallback.
 */
export function getSearchLimits(): SearchLimitsConfig {
  if (cached) return cached;
  const env = getServerEnv();
  const bucketName = process.env.SEARCH_INDEX_BUCKET?.trim() || null;

  const indexMode = resolveSearchIndexMode({
    nodeEnv: env.NODE_ENV,
    rawMode: process.env.SEARCH_INDEX_MODE,
  });

  if (indexMode === "gcs" && !bucketName) {
    throw new Error(
      "SEARCH_INDEX_BUCKET is required when SEARCH_INDEX_MODE=gcs (set explicitly; no silent media-bucket fallback)",
    );
  }

  const indexPrefix = (() => {
    try {
      return assertSearchIndexPrefix(
        process.env.SEARCH_INDEX_PREFIX?.trim() || "search",
      );
    } catch {
      throw new Error("Invalid SEARCH_INDEX_PREFIX");
    }
  })();

  cached = {
    indexMode,
    bucketName,
    indexPrefix,
    cacheTtlSeconds: parseBoundedInt(
      process.env.SEARCH_INDEX_CACHE_TTL_SECONDS,
      SEARCH_LIMIT_DEFAULTS.manifestCacheTtlSeconds,
      SEARCH_ENV_BOUNDS.cacheTtlMin,
      SEARCH_ENV_BOUNDS.cacheTtlMax,
      "SEARCH_INDEX_CACHE_TTL_SECONDS",
    ),
    generationCacheTtlSeconds: SEARCH_LIMIT_DEFAULTS.generationCacheTtlSeconds,
    queryMaxLength: parseBoundedInt(
      process.env.SEARCH_QUERY_MAX_LENGTH,
      SEARCH_LIMIT_DEFAULTS.queryMaxLength,
      SEARCH_ENV_BOUNDS.queryMaxLengthMin,
      SEARCH_ENV_BOUNDS.queryMaxLengthMax,
      "SEARCH_QUERY_MAX_LENGTH",
    ),
    pageMaxSize: parseBoundedInt(
      process.env.SEARCH_PAGE_MAX_SIZE,
      SEARCH_LIMIT_DEFAULTS.pageMaxSize,
      SEARCH_ENV_BOUNDS.pageMaxSizeMin,
      SEARCH_ENV_BOUNDS.pageMaxSizeMax,
      "SEARCH_PAGE_MAX_SIZE",
    ),
    pageDefaultSize: SEARCH_LIMIT_DEFAULTS.pageDefaultSize,
    maxDocuments: parseBoundedInt(
      process.env.SEARCH_INDEX_MAX_DOCUMENTS,
      SEARCH_LIMIT_DEFAULTS.maxDocuments,
      SEARCH_ENV_BOUNDS.maxDocumentsMin,
      SEARCH_ENV_BOUNDS.maxDocumentsMax,
      "SEARCH_INDEX_MAX_DOCUMENTS",
    ),
    maxIndexBytes: parseBoundedInt(
      process.env.SEARCH_INDEX_MAX_BYTES,
      SEARCH_LIMIT_DEFAULTS.maxIndexBytes,
      SEARCH_ENV_BOUNDS.maxIndexBytesMin,
      SEARCH_ENV_BOUNDS.maxIndexBytesMax,
      "SEARCH_INDEX_MAX_BYTES",
    ),
    maxDocumentCharacters: parseBoundedInt(
      process.env.SEARCH_DOCUMENT_MAX_CHARACTERS,
      SEARCH_LIMIT_DEFAULTS.maxDocumentCharacters,
      SEARCH_ENV_BOUNDS.maxDocumentCharactersMin,
      SEARCH_ENV_BOUNDS.maxDocumentCharactersMax,
      "SEARCH_DOCUMENT_MAX_CHARACTERS",
    ),
    casMaxRetries: SEARCH_LIMIT_DEFAULTS.casMaxRetries,
    visibilityOverfetchFactor: SEARCH_LIMIT_DEFAULTS.visibilityOverfetchFactor,
    visibilityMaxScan: SEARCH_LIMIT_DEFAULTS.visibilityMaxScan,
    visibilityBatchSize: SEARCH_LIMIT_DEFAULTS.visibilityBatchSize,
    rebuildPageSize: SEARCH_LIMIT_DEFAULTS.rebuildPageSize,
    rebuildMaxPages: SEARCH_LIMIT_DEFAULTS.rebuildMaxPages,
    cursorHmacSecret: resolveCursorHmacSecret(env.NODE_ENV),
  };
  return cached;
}

export function resolveSearchIndexMode(input: {
  nodeEnv: "development" | "test" | "production";
  rawMode: string | undefined;
}): SearchIndexMode {
  const trimmed = input.rawMode?.trim() ?? "";

  if (input.nodeEnv === "production") {
    if (!trimmed) {
      throw new Error(
        "SEARCH_INDEX_MODE is required in production (must be gcs)",
      );
    }
    if (trimmed === "memory") {
      throw new Error("SEARCH_INDEX_MODE=memory is forbidden in production");
    }
    if (trimmed !== "gcs") {
      throw new Error(
        `Unknown SEARCH_INDEX_MODE "${trimmed}" (allowed: gcs in production)`,
      );
    }
    return "gcs";
  }

  if (trimmed) {
    if (trimmed !== "gcs" && trimmed !== "memory") {
      throw new Error(
        `Unknown SEARCH_INDEX_MODE "${trimmed}" (allowed: memory|gcs)`,
      );
    }
    return trimmed;
  }

  if (input.nodeEnv === "test") {
    return "memory";
  }
  return "memory";
}

function resolveCursorHmacSecret(
  nodeEnv: "development" | "test" | "production",
): string {
  const raw = process.env.SEARCH_CURSOR_HMAC_SECRET;
  const trimmed = raw?.trim() ?? "";
  if (nodeEnv === "production") {
    if (!trimmed) {
      throw new Error("SEARCH_CURSOR_HMAC_SECRET is required in production");
    }
    if (trimmed.length < SEARCH_LIMIT_DEFAULTS.cursorHmacSecretMinLength) {
      throw new Error(
        `SEARCH_CURSOR_HMAC_SECRET must be at least ${SEARCH_LIMIT_DEFAULTS.cursorHmacSecretMinLength} characters`,
      );
    }
    return trimmed;
  }
  if (trimmed) {
    if (trimmed.length < 8) {
      throw new Error("SEARCH_CURSOR_HMAC_SECRET is too short");
    }
    return trimmed;
  }
  // Documented local/test fixture only — never used in production.
  return "test-search-cursor-hmac-secret-fixture-32b";
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

export function resetSearchEnvCacheForTests(): void {
  cached = null;
}
