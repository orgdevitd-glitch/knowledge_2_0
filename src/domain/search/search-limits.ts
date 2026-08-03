/**
 * Centralized Search Foundation limits (Phase 8B.1).
 * Env overrides via getSearchLimits() — do not scatter magic numbers.
 */
export const SEARCH_ENTITY_TYPES = ["article", "prompt"] as const;
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export const SEARCH_DOCUMENT_STATES = ["active", "removed"] as const;
export type SearchDocumentState = (typeof SEARCH_DOCUMENT_STATES)[number];

export const SEARCH_DOCUMENT_SCHEMA_VERSION = 2 as const;

export const SEARCH_LIMIT_DEFAULTS = {
  queryMaxLength: 120,
  queryMinLength: 2,
  pageDefaultSize: 20,
  pageMaxSize: 50,
  maxDocuments: 5_000,
  maxIndexBytes: 25 * 1024 * 1024,
  maxDocumentCharacters: 20_000,
  manifestCacheTtlSeconds: 30,
  generationCacheTtlSeconds: 300,
  casMaxRetries: 5,
  visibilityOverfetchFactor: 3,
  visibilityMaxScan: 200,
  visibilityBatchSize: 50,
  rebuildPageSize: 50,
  rebuildMaxPages: 10_000,
  freshnessMaxBoost: 5,
  snippetMaxLength: 220,
  cursorHmacSecretMinLength: 32,
} as const;

/** Ranking weights — transparent and tested. */
export const SEARCH_SCORE_WEIGHTS_V2 = {
  exactTitle: 100,
  titlePrefix: 70,
  titleToken: 40,
  headingToken: 15,
  summaryToken: 20,
  bodyToken: 5,
  freshnessMax: 5,
} as const;

export const SEARCH_ENV_BOUNDS = {
  queryMaxLengthMin: 20,
  queryMaxLengthMax: 500,
  pageMaxSizeMin: 5,
  pageMaxSizeMax: 100,
  maxDocumentsMin: 10,
  maxDocumentsMax: 50_000,
  maxIndexBytesMin: 64 * 1024,
  maxIndexBytesMax: 100 * 1024 * 1024,
  maxDocumentCharactersMin: 1_000,
  maxDocumentCharactersMax: 100_000,
  cacheTtlMin: 0,
  cacheTtlMax: 3_600,
} as const;
