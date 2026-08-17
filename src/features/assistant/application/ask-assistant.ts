import "server-only";

import { getAssistantConfig } from "@/config/assistant-env";
import {
  buildProviderEvidence,
  parseProviderResult,
  toPublicAnsweredDto,
  validateAndBuildCitations,
} from "@/domain/assistant/citations";
import { assertSafeAssistantSearchHref } from "@/domain/assistant/search-fallback";
import { ASSISTANT_SYSTEM_POLICY_VERSION } from "@/domain/assistant/system-policy";
import {
  mapRefusalCategoryToStatus,
  publicMessageForStatus,
} from "@/domain/assistant/refusal-messages";
import { normalizeAssistantQuestion } from "@/domain/assistant/text";
import type {
  AssistantContentScope,
  AssistantFilters,
  AssistantPublicResponse,
  AssistantRefusalCategory,
  AssistantRequestStatus,
} from "@/domain/assistant/types";
import { buildSearchHref } from "@/features/search/url/search-url-state";
import { logger } from "@/lib/logger";
import { getAssistantSystemPolicy } from "@/server/assistant/system-policy";
import type { AssistantProviderPort } from "@/server/repositories/interfaces/assistant-provider-port";
import type { AssistantRateLimitPort } from "@/server/repositories/interfaces/assistant-rate-limit-port";
import type { AssistantRetrievalPort } from "@/server/repositories/interfaces/assistant-retrieval-port";

export type AskAssistantInput = {
  question: string;
  filters?: {
    type?: AssistantContentScope;
    category?: string | null;
    tag?: string | null;
    audience?: string | null;
  };
  requestId: string;
  rateLimitKey: string;
  /** Optional external abort (route cancellation). */
  signal?: AbortSignal;
};

export type AskAssistantDeps = {
  retrieval: AssistantRetrievalPort;
  provider: AssistantProviderPort;
  rateLimit: AssistantRateLimitPort;
  now?: () => number;
};

export type AskAssistantResult = {
  httpStatus: number;
  body: AssistantPublicResponse;
  retryAfterSeconds?: number;
};

function normalizeFilters(
  input: AskAssistantInput["filters"],
): AssistantFilters {
  const type: AssistantContentScope =
    input?.type === "prompt" || input?.type === "all" ? input.type : "article";
  return {
    type,
    categoryId: cleanId(input?.category),
    tagId: cleanId(input?.tag),
    audienceId: cleanId(input?.audience),
  };
}

function cleanId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Taxonomy IDs: reject control chars / path separators in fallback URLs.
  if (/[\u0000-\u001f\u007f\\/]/.test(trimmed)) return null;
  return trimmed.slice(0, 128);
}

function durationBucket(ms: number, bucketSize: number): number {
  return Math.ceil(ms / bucketSize) * bucketSize;
}

function refusal(
  status: Exclude<AssistantRequestStatus, "answered">,
  options?: {
    searchHref?: string;
    httpStatus?: number;
    retryAfterSeconds?: number;
  },
): AskAssistantResult {
  const safeHref = options?.searchHref
    ? assertSafeAssistantSearchHref(options.searchHref) ?? undefined
    : undefined;
  return {
    httpStatus: options?.httpStatus ?? statusHttp(status),
    retryAfterSeconds: options?.retryAfterSeconds,
    body: {
      status,
      message: publicMessageForStatus(status),
      ...(safeHref ? { searchHref: safeHref } : {}),
    },
  };
}

function statusHttp(status: AssistantRequestStatus): number {
  switch (status) {
    case "answered":
      return 200;
    case "insufficient_evidence":
      return 200;
    case "validation_error":
      return 400;
    case "rate_limited":
      return 429;
    case "temporarily_unavailable":
      return 503;
    default:
      return 503;
  }
}

function buildFallbackSearchHref(
  question: string,
  filters: AssistantFilters,
): string {
  return buildSearchHref({
    q: question.slice(0, 120),
    type: filters.type === "all" ? null : filters.type,
    category: filters.categoryId,
    tag: filters.tagId,
    audience: filters.audienceId,
    cursor: null,
  });
}

function logOps(input: {
  requestId: string;
  status: AssistantRequestStatus;
  durationMs: number;
  evidenceSourceCount: number;
  evidenceChunkCount: number;
  answerBlockCount: number;
  citationCount: number;
  refusalCategory?: AssistantRefusalCategory;
  timedOut?: boolean;
  rateLimited?: boolean;
}) {
  const cfg = getAssistantConfig();
  logger.info("assistant.ask", {
    requestId: input.requestId,
    status: input.status,
    durationBucket: durationBucket(input.durationMs, cfg.durationBucketMs),
    evidenceSourceCount: input.evidenceSourceCount,
    evidenceChunkCount: input.evidenceChunkCount,
    answerBlockCount: input.answerBlockCount,
    citationCount: input.citationCount,
    refusalCategory: input.refusalCategory,
    timedOut: input.timedOut ?? false,
    rateLimited: input.rateLimited ?? false,
    policyVersion: ASSISTANT_SYSTEM_POLICY_VERSION,
  });
}

function linkAbortSignals(
  outer: AbortSignal | undefined,
  inner: AbortController,
): () => void {
  if (!outer) return () => undefined;
  if (outer.aborted) {
    inner.abort();
    return () => undefined;
  }
  const onAbort = () => inner.abort();
  outer.addEventListener("abort", onAbort, { once: true });
  return () => outer.removeEventListener("abort", onAbort);
}

/** Ensure abort rejects even when provider ignores AbortSignal. */
function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Stateless single-turn grounded ask. No Next.js Request/Response types.
 * Does not persist questions, answers, or conversations.
 * Rate-limit / concurrency live here (not route-only).
 */
export async function askAssistant(
  input: AskAssistantInput,
  deps: AskAssistantDeps,
): Promise<AskAssistantResult> {
  const started = (deps.now ?? Date.now)();
  const cfg = getAssistantConfig();
  const filters = normalizeFilters(input.filters);
  const normalized = normalizeAssistantQuestion(input.question);

  // Re-validate AFTER normalization (Unicode / controls / whitespace).
  if (
    !normalized ||
    normalized.length < cfg.questionMinLength ||
    normalized.length > cfg.questionMaxLength ||
    input.question.length > cfg.questionMaxLength
  ) {
    const result = refusal("validation_error", { httpStatus: 400 });
    logOps({
      requestId: input.requestId,
      status: "validation_error",
      durationMs: (deps.now ?? Date.now)() - started,
      evidenceSourceCount: 0,
      evidenceChunkCount: 0,
      answerBlockCount: 0,
      citationCount: 0,
    });
    return result;
  }

  // Disabled: no retrieval, no provider, no question logging.
  if (cfg.mode === "disabled") {
    const result = refusal("temporarily_unavailable", { httpStatus: 503 });
    logOps({
      requestId: input.requestId,
      status: "temporarily_unavailable",
      durationMs: (deps.now ?? Date.now)() - started,
      evidenceSourceCount: 0,
      evidenceChunkCount: 0,
      answerBlockCount: 0,
      citationCount: 0,
      refusalCategory: "assistant_disabled",
    });
    return result;
  }

  const limited = deps.rateLimit.take(input.rateLimitKey);
  if (!limited.allowed) {
    const result = refusal("rate_limited", {
      httpStatus: 429,
      retryAfterSeconds: limited.retryAfterSeconds,
    });
    logOps({
      requestId: input.requestId,
      status: "rate_limited",
      durationMs: (deps.now ?? Date.now)() - started,
      evidenceSourceCount: 0,
      evidenceChunkCount: 0,
      answerBlockCount: 0,
      citationCount: 0,
      rateLimited: true,
    });
    return result;
  }

  const concurrency = deps.rateLimit.acquireConcurrency(input.rateLimitKey);
  if (!concurrency.allowed) {
    const result = refusal("rate_limited", { httpStatus: 429 });
    logOps({
      requestId: input.requestId,
      status: "rate_limited",
      durationMs: (deps.now ?? Date.now)() - started,
      evidenceSourceCount: 0,
      evidenceChunkCount: 0,
      answerBlockCount: 0,
      citationCount: 0,
      rateLimited: true,
    });
    return result;
  }

  const controller = new AbortController();
  const unlinkOuter = linkAbortSignals(input.signal, controller);
  const appTimeout = setTimeout(
    () => controller.abort(),
    cfg.applicationTimeoutMs,
  );
  let providerTimeout: ReturnType<typeof setTimeout> | null = null;

  try {
    if (controller.signal.aborted) {
      return refusalUnavailable(
        input,
        started,
        true,
      );
    }

    const retrieval = await raceWithAbort(
      deps.retrieval.retrieve({
        question: normalized,
        filters,
      }),
      controller.signal,
    );

    if (controller.signal.aborted) {
      return refusalUnavailable(input, started, true);
    }

    if (retrieval.status === "unavailable") {
      const result = refusal("temporarily_unavailable");
      logOps({
        requestId: input.requestId,
        status: "temporarily_unavailable",
        durationMs: (deps.now ?? Date.now)() - started,
        evidenceSourceCount: 0,
        evidenceChunkCount: 0,
        answerBlockCount: 0,
        citationCount: 0,
        refusalCategory: "retrieval_unavailable",
      });
      return result;
    }

    if (retrieval.status === "empty" || retrieval.status === "incomplete") {
      const category: AssistantRefusalCategory =
        retrieval.status === "incomplete"
          ? "incomplete_retrieval"
          : "no_evidence";
      const result = refusal("insufficient_evidence", {
        searchHref: buildFallbackSearchHref(normalized, filters),
      });
      logOps({
        requestId: input.requestId,
        status: "insufficient_evidence",
        durationMs: (deps.now ?? Date.now)() - started,
        evidenceSourceCount: 0,
        evidenceChunkCount: 0,
        answerBlockCount: 0,
        citationCount: 0,
        refusalCategory: category,
      });
      return result;
    }

    const { providerEvidence, keyToSourceId } = buildProviderEvidence(
      retrieval.sources,
      retrieval.chunks,
    );

    // Ensure server policy is loaded (version only crosses provider boundary).
    const policy = getAssistantSystemPolicy();

    providerTimeout = setTimeout(
      () => controller.abort(),
      cfg.providerTimeoutMs,
    );

    let rawProviderResult: unknown;
    try {
      rawProviderResult = await raceWithAbort(
        deps.provider.generateGroundedAnswer(
          {
            normalizedQuestion: normalized,
            filtersSummary: filters,
            evidence: providerEvidence,
            systemPolicyVersion: policy.version,
            locale: "ru",
            maximumAnswerBlocks: cfg.maxAnswerBlocks,
            maximumAnswerCharacters: cfg.maxAnswerCharacters,
            outputSchema: "grounded_blocks_v1",
          },
          controller.signal,
        ),
        controller.signal,
      );
    } finally {
      if (providerTimeout) clearTimeout(providerTimeout);
      providerTimeout = null;
    }

    if (controller.signal.aborted) {
      // Late provider results are ignored after abort.
      return refusalUnavailable(input, started, true, {
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
      });
    }

    const providerResult = parseProviderResult(rawProviderResult);
    if (!providerResult) {
      const result = refusal("insufficient_evidence", {
        searchHref: buildFallbackSearchHref(normalized, filters),
      });
      logOps({
        requestId: input.requestId,
        status: "insufficient_evidence",
        durationMs: (deps.now ?? Date.now)() - started,
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
        answerBlockCount: 0,
        citationCount: 0,
        refusalCategory: "invalid_provider_response",
      });
      return result;
    }

    if (
      providerResult.kind === "refused" &&
      (providerResult.providerStatus === "unavailable" ||
        providerResult.providerStatus === "timeout" ||
        providerResult.finishReason === "timeout" ||
        providerResult.finishReason === "cancelled")
    ) {
      const result = refusal("temporarily_unavailable");
      logOps({
        requestId: input.requestId,
        status: "temporarily_unavailable",
        durationMs: (deps.now ?? Date.now)() - started,
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
        answerBlockCount: 0,
        citationCount: 0,
        refusalCategory: "provider_unavailable",
        timedOut: providerResult.finishReason === "timeout",
      });
      return result;
    }

    const citations = validateAndBuildCitations({
      providerResult,
      sources: retrieval.sources,
      chunks: retrieval.chunks,
      keyToSourceId,
      maxAnswerBlocks: cfg.maxAnswerBlocks,
      maxAnswerCharacters: cfg.maxAnswerCharacters,
      maxCitations: cfg.maxCitations,
      maxEvidenceKeysPerBlock: cfg.maxEvidenceKeysPerBlock,
      excerptMaxCharacters: cfg.excerptMaxCharacters,
    });

    if (!citations.ok) {
      const status = mapRefusalCategoryToStatus(citations.category);
      const result = refusal(status, {
        searchHref:
          status === "insufficient_evidence"
            ? buildFallbackSearchHref(normalized, filters)
            : undefined,
      });
      logOps({
        requestId: input.requestId,
        status,
        durationMs: (deps.now ?? Date.now)() - started,
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
        answerBlockCount: 0,
        citationCount: 0,
        refusalCategory: citations.category,
      });
      return result;
    }

    if (controller.signal.aborted) {
      return refusalUnavailable(input, started, true, {
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
      });
    }

    const usedSourceIds = new Set<string>();
    for (const block of citations.blocks) {
      for (const key of block.evidenceKeys) {
        const sourceId = keyToSourceId.get(key);
        if (sourceId) usedSourceIds.add(sourceId);
      }
    }
    const usedSources = retrieval.sources.filter((s) =>
      usedSourceIds.has(s.sourceId),
    );
    const revalidation = await raceWithAbort(
      deps.retrieval.revalidate(
        usedSources.map((s) => ({
          entityType: s.entityType,
          entityId: s.entityId,
          versionId: s.versionId,
        })),
      ),
      controller.signal,
    );

    if (controller.signal.aborted) {
      return refusalUnavailable(input, started, true, {
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
      });
    }

    if (!revalidation.valid) {
      const result = refusal("insufficient_evidence", {
        searchHref: buildFallbackSearchHref(normalized, filters),
      });
      logOps({
        requestId: input.requestId,
        status: "insufficient_evidence",
        durationMs: (deps.now ?? Date.now)() - started,
        evidenceSourceCount: retrieval.sources.length,
        evidenceChunkCount: retrieval.chunks.length,
        answerBlockCount: 0,
        citationCount: 0,
        refusalCategory: "stale_evidence",
      });
      return result;
    }

    const body = toPublicAnsweredDto({
      blocks: citations.blocks,
      citations: citations.citations,
    });

    logOps({
      requestId: input.requestId,
      status: "answered",
      durationMs: (deps.now ?? Date.now)() - started,
      evidenceSourceCount: retrieval.sources.length,
      evidenceChunkCount: retrieval.chunks.length,
      answerBlockCount: body.blocks.length,
      citationCount: body.citations.length,
    });

    return { httpStatus: 200, body };
  } catch {
    // Never log Error.message — may embed question/evidence/secrets.
    if (controller.signal.aborted) {
      return refusalUnavailable(input, started, true);
    }
    logger.error("assistant.ask.failed", {
      requestId: input.requestId,
      status: "temporarily_unavailable",
    });
    return refusal("temporarily_unavailable");
  } finally {
    clearTimeout(appTimeout);
    if (providerTimeout) clearTimeout(providerTimeout);
    unlinkOuter();
    concurrency.release();
  }
}

function refusalUnavailable(
  input: AskAssistantInput,
  started: number,
  timedOut: boolean,
  counts?: { evidenceSourceCount: number; evidenceChunkCount: number },
): AskAssistantResult {
  const result = refusal("temporarily_unavailable");
  logOps({
    requestId: input.requestId,
    status: "temporarily_unavailable",
    durationMs: Date.now() - started,
    evidenceSourceCount: counts?.evidenceSourceCount ?? 0,
    evidenceChunkCount: counts?.evidenceChunkCount ?? 0,
    answerBlockCount: 0,
    citationCount: 0,
    refusalCategory: "provider_unavailable",
    timedOut,
  });
  return result;
}
