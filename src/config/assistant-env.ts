import "server-only";

import {
  ASSISTANT_ENV_BOUNDS,
  ASSISTANT_LIMIT_DEFAULTS,
  type AssistantLimits,
} from "@/domain/assistant/limits";
import { getServerEnv } from "@/config/env";

export type AssistantMode = "disabled" | "fake";

export type AssistantConfig = AssistantLimits & {
  mode: AssistantMode;
};

let cached: AssistantConfig | null = null;

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function resolveAssistantMode(input: {
  nodeEnv: string;
  rawMode: string | undefined;
}): AssistantMode {
  const raw = input.rawMode?.trim().toLowerCase();
  if (!raw || raw === "disabled") return "disabled";
  if (raw === "fake") {
    if (input.nodeEnv === "production") {
      throw new Error(
        "ASSISTANT_MODE=fake is forbidden in production (Phase 8C.1)",
      );
    }
    return "fake";
  }
  throw new Error(
    `Unknown ASSISTANT_MODE="${raw}". Allowed: disabled|fake (no production LLM provider in 8C.1)`,
  );
}

/**
 * Server-only assistant configuration.
 * Production defaults to disabled. Fake is test/dev only.
 * No NEXT_PUBLIC_* assistant variables. No provider API keys in 8C.1.
 */
export function getAssistantConfig(): AssistantConfig {
  if (cached) return cached;
  const env = getServerEnv();
  const mode = resolveAssistantMode({
    nodeEnv: env.NODE_ENV,
    rawMode: process.env.ASSISTANT_MODE,
  });

  const providerTimeoutMs = parseBoundedInt(
    process.env.ASSISTANT_PROVIDER_TIMEOUT_MS,
    ASSISTANT_LIMIT_DEFAULTS.providerTimeoutMs,
    ASSISTANT_ENV_BOUNDS.providerTimeoutMsMin,
    ASSISTANT_ENV_BOUNDS.providerTimeoutMsMax,
    "ASSISTANT_PROVIDER_TIMEOUT_MS",
  );
  const applicationTimeoutMs = parseBoundedInt(
    process.env.ASSISTANT_APPLICATION_TIMEOUT_MS,
    ASSISTANT_LIMIT_DEFAULTS.applicationTimeoutMs,
    ASSISTANT_ENV_BOUNDS.applicationTimeoutMsMin,
    ASSISTANT_ENV_BOUNDS.applicationTimeoutMsMax,
    "ASSISTANT_APPLICATION_TIMEOUT_MS",
  );
  if (applicationTimeoutMs < providerTimeoutMs) {
    throw new Error(
      "ASSISTANT_APPLICATION_TIMEOUT_MS must be >= ASSISTANT_PROVIDER_TIMEOUT_MS",
    );
  }

  cached = {
    mode,
    questionMinLength: ASSISTANT_LIMIT_DEFAULTS.questionMinLength,
    questionMaxLength: parseBoundedInt(
      process.env.ASSISTANT_QUESTION_MAX_LENGTH,
      ASSISTANT_LIMIT_DEFAULTS.questionMaxLength,
      ASSISTANT_ENV_BOUNDS.questionMaxLengthMin,
      ASSISTANT_ENV_BOUNDS.questionMaxLengthMax,
      "ASSISTANT_QUESTION_MAX_LENGTH",
    ),
    maxRetrievalCandidates: parseBoundedInt(
      process.env.ASSISTANT_MAX_RETRIEVAL_CANDIDATES,
      ASSISTANT_LIMIT_DEFAULTS.maxRetrievalCandidates,
      ASSISTANT_ENV_BOUNDS.maxRetrievalCandidatesMin,
      ASSISTANT_ENV_BOUNDS.maxRetrievalCandidatesMax,
      "ASSISTANT_MAX_RETRIEVAL_CANDIDATES",
    ),
    maxSources: parseBoundedInt(
      process.env.ASSISTANT_MAX_SOURCES,
      ASSISTANT_LIMIT_DEFAULTS.maxSources,
      ASSISTANT_ENV_BOUNDS.maxSourcesMin,
      ASSISTANT_ENV_BOUNDS.maxSourcesMax,
      "ASSISTANT_MAX_SOURCES",
    ),
    maxChunksPerSource: parseBoundedInt(
      process.env.ASSISTANT_MAX_CHUNKS_PER_SOURCE,
      ASSISTANT_LIMIT_DEFAULTS.maxChunksPerSource,
      ASSISTANT_ENV_BOUNDS.maxChunksPerSourceMin,
      ASSISTANT_ENV_BOUNDS.maxChunksPerSourceMax,
      "ASSISTANT_MAX_CHUNKS_PER_SOURCE",
    ),
    maxChunkCharacters: parseBoundedInt(
      process.env.ASSISTANT_MAX_CHUNK_CHARACTERS,
      ASSISTANT_LIMIT_DEFAULTS.maxChunkCharacters,
      ASSISTANT_ENV_BOUNDS.maxChunkCharactersMin,
      ASSISTANT_ENV_BOUNDS.maxChunkCharactersMax,
      "ASSISTANT_MAX_CHUNK_CHARACTERS",
    ),
    maxTotalEvidenceCharacters: parseBoundedInt(
      process.env.ASSISTANT_MAX_EVIDENCE_CHARACTERS,
      ASSISTANT_LIMIT_DEFAULTS.maxTotalEvidenceCharacters,
      ASSISTANT_ENV_BOUNDS.maxTotalEvidenceCharactersMin,
      ASSISTANT_ENV_BOUNDS.maxTotalEvidenceCharactersMax,
      "ASSISTANT_MAX_EVIDENCE_CHARACTERS",
    ),
    maxAnswerBlocks: parseBoundedInt(
      process.env.ASSISTANT_MAX_ANSWER_BLOCKS,
      ASSISTANT_LIMIT_DEFAULTS.maxAnswerBlocks,
      ASSISTANT_ENV_BOUNDS.maxAnswerBlocksMin,
      ASSISTANT_ENV_BOUNDS.maxAnswerBlocksMax,
      "ASSISTANT_MAX_ANSWER_BLOCKS",
    ),
    maxAnswerCharacters: parseBoundedInt(
      process.env.ASSISTANT_MAX_ANSWER_CHARACTERS,
      ASSISTANT_LIMIT_DEFAULTS.maxAnswerCharacters,
      ASSISTANT_ENV_BOUNDS.maxAnswerCharactersMin,
      ASSISTANT_ENV_BOUNDS.maxAnswerCharactersMax,
      "ASSISTANT_MAX_ANSWER_CHARACTERS",
    ),
    maxCitations: parseBoundedInt(
      process.env.ASSISTANT_MAX_CITATIONS,
      ASSISTANT_LIMIT_DEFAULTS.maxCitations,
      ASSISTANT_ENV_BOUNDS.maxCitationsMin,
      ASSISTANT_ENV_BOUNDS.maxCitationsMax,
      "ASSISTANT_MAX_CITATIONS",
    ),
    maxEvidenceKeysPerBlock: ASSISTANT_LIMIT_DEFAULTS.maxEvidenceKeysPerBlock,
    providerTimeoutMs,
    applicationTimeoutMs,
    requestBodyMaxBytes: parseBoundedInt(
      process.env.ASSISTANT_REQUEST_BODY_MAX_BYTES,
      ASSISTANT_LIMIT_DEFAULTS.requestBodyMaxBytes,
      ASSISTANT_ENV_BOUNDS.requestBodyMaxBytesMin,
      ASSISTANT_ENV_BOUNDS.requestBodyMaxBytesMax,
      "ASSISTANT_REQUEST_BODY_MAX_BYTES",
    ),
    rateLimitWindowMs: ASSISTANT_LIMIT_DEFAULTS.rateLimitWindowMs,
    rateLimitRequestsPerWindow: parseBoundedInt(
      process.env.ASSISTANT_RATE_LIMIT_PER_WINDOW,
      ASSISTANT_LIMIT_DEFAULTS.rateLimitRequestsPerWindow,
      ASSISTANT_ENV_BOUNDS.rateLimitRequestsPerWindowMin,
      ASSISTANT_ENV_BOUNDS.rateLimitRequestsPerWindowMax,
      "ASSISTANT_RATE_LIMIT_PER_WINDOW",
    ),
    maxConcurrentRequests: parseBoundedInt(
      process.env.ASSISTANT_MAX_CONCURRENT_REQUESTS,
      ASSISTANT_LIMIT_DEFAULTS.maxConcurrentRequests,
      ASSISTANT_ENV_BOUNDS.maxConcurrentRequestsMin,
      ASSISTANT_ENV_BOUNDS.maxConcurrentRequestsMax,
      "ASSISTANT_MAX_CONCURRENT_REQUESTS",
    ),
    hydrationBatchSize: parseBoundedInt(
      process.env.ASSISTANT_HYDRATION_BATCH_SIZE,
      ASSISTANT_LIMIT_DEFAULTS.hydrationBatchSize,
      ASSISTANT_ENV_BOUNDS.hydrationBatchSizeMin,
      ASSISTANT_ENV_BOUNDS.hydrationBatchSizeMax,
      "ASSISTANT_HYDRATION_BATCH_SIZE",
    ),
    visibilityMaxScan: ASSISTANT_LIMIT_DEFAULTS.visibilityMaxScan,
    excerptMaxCharacters: ASSISTANT_LIMIT_DEFAULTS.excerptMaxCharacters,
    durationBucketMs: ASSISTANT_LIMIT_DEFAULTS.durationBucketMs,
  };

  return cached;
}

export function resetAssistantEnvCacheForTests(): void {
  cached = null;
}
