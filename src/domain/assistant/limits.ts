/**
 * Centralized Knowledge Assistant limits (Phase 8C.1).
 * Env overrides via getAssistantLimits() — do not scatter magic numbers.
 */

export const ASSISTANT_POLICY_VERSION = "assistant-policy-v1" as const;

export const ASSISTANT_LIMIT_DEFAULTS = {
  questionMinLength: 3,
  questionMaxLength: 500,
  maxRetrievalCandidates: 24,
  maxSources: 6,
  maxChunksPerSource: 4,
  maxChunkCharacters: 1_200,
  maxTotalEvidenceCharacters: 8_000,
  maxAnswerBlocks: 8,
  maxAnswerCharacters: 4_000,
  maxCitations: 8,
  maxEvidenceKeysPerBlock: 4,
  providerTimeoutMs: 12_000,
  applicationTimeoutMs: 20_000,
  requestBodyMaxBytes: 8_192,
  rateLimitWindowMs: 60_000,
  rateLimitRequestsPerWindow: 10,
  maxConcurrentRequests: 2,
  hydrationBatchSize: 20,
  visibilityMaxScan: 120,
  excerptMaxCharacters: 180,
  durationBucketMs: 250,
} as const;

export const ASSISTANT_ENV_BOUNDS = {
  questionMaxLengthMin: 50,
  questionMaxLengthMax: 2_000,
  maxRetrievalCandidatesMin: 4,
  maxRetrievalCandidatesMax: 100,
  maxSourcesMin: 1,
  maxSourcesMax: 20,
  maxChunksPerSourceMin: 1,
  maxChunksPerSourceMax: 20,
  maxChunkCharactersMin: 200,
  maxChunkCharactersMax: 4_000,
  maxTotalEvidenceCharactersMin: 1_000,
  maxTotalEvidenceCharactersMax: 40_000,
  maxAnswerBlocksMin: 1,
  maxAnswerBlocksMax: 20,
  maxAnswerCharactersMin: 200,
  maxAnswerCharactersMax: 20_000,
  maxCitationsMin: 1,
  maxCitationsMax: 20,
  providerTimeoutMsMin: 50,
  providerTimeoutMsMax: 60_000,
  applicationTimeoutMsMin: 100,
  applicationTimeoutMsMax: 90_000,
  requestBodyMaxBytesMin: 1_024,
  requestBodyMaxBytesMax: 65_536,
  rateLimitRequestsPerWindowMin: 1,
  rateLimitRequestsPerWindowMax: 120,
  maxConcurrentRequestsMin: 1,
  maxConcurrentRequestsMax: 20,
  hydrationBatchSizeMin: 5,
  hydrationBatchSizeMax: 50,
} as const;

export type AssistantLimits = {
  questionMinLength: number;
  questionMaxLength: number;
  maxRetrievalCandidates: number;
  maxSources: number;
  maxChunksPerSource: number;
  maxChunkCharacters: number;
  maxTotalEvidenceCharacters: number;
  maxAnswerBlocks: number;
  maxAnswerCharacters: number;
  maxCitations: number;
  maxEvidenceKeysPerBlock: number;
  providerTimeoutMs: number;
  applicationTimeoutMs: number;
  requestBodyMaxBytes: number;
  rateLimitWindowMs: number;
  rateLimitRequestsPerWindow: number;
  maxConcurrentRequests: number;
  hydrationBatchSize: number;
  visibilityMaxScan: number;
  excerptMaxCharacters: number;
  durationBucketMs: number;
};
