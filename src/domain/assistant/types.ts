/**
 * Knowledge Assistant domain types (Phase 8C.1).
 * Internal evidence may carry version identity; public DTOs must not.
 */

export type AssistantEntityType = "article" | "prompt";

export type AssistantContentScope = "article" | "prompt" | "all";

export type AssistantRequestStatus =
  | "answered"
  | "insufficient_evidence"
  | "validation_error"
  | "rate_limited"
  | "temporarily_unavailable";

export type AssistantRefusalCategory =
  | "no_evidence"
  | "incomplete_retrieval"
  | "unsupported_request"
  | "external_information_required"
  | "action_requested"
  | "invalid_provider_response"
  | "missing_citations"
  | "stale_evidence"
  | "provider_refusal"
  | "output_limit_exceeded"
  | "provider_unavailable"
  | "retrieval_unavailable"
  | "assistant_disabled";

export type AssistantQuestion = {
  raw: string;
  normalized: string;
};

export type AssistantFilters = {
  /** Default scope is article-only; prompts require prompt|all. */
  type: AssistantContentScope;
  categoryId: string | null;
  tagId: string | null;
  audienceId: string | null;
};

export type AssistantEvidenceSource = {
  sourceId: string;
  entityType: AssistantEntityType;
  entityId: string;
  versionId: string;
  title: string;
  href: string;
  publishedAt: string | null;
  order: number;
};

export type AssistantEvidenceChunk = {
  chunkId: string;
  sourceId: string;
  versionId: string;
  headingPath: string;
  text: string;
  ordinal: number;
  characterCount: number;
  /** Prompt chunks always untrusted reference data. */
  trustBoundary: "published_content" | "untrusted_prompt_reference";
};

export type AssistantProviderEvidence = {
  evidenceKey: string;
  sourceLabel: string;
  sourceTitle: string;
  entityType: AssistantEntityType;
  evidenceText: string;
  instructionBoundary: "untrusted_data";
  trustBoundary: "published_content" | "untrusted_prompt_reference";
};

export type AssistantAnswerBlock = {
  text: string;
  evidenceKeys: string[];
};

export type AssistantCitation = {
  number: number;
  title: string;
  href: string;
  entityType: AssistantEntityType;
  excerpt?: string;
};

export type AssistantUsage = {
  inputCharacters: number;
  outputCharacters: number;
  evidenceSourceCount: number;
  evidenceChunkCount: number;
};

export type AssistantAnsweredResponse = {
  status: "answered";
  blocks: Array<{
    text: string;
    citationNumbers: number[];
  }>;
  citations: AssistantCitation[];
};

export type AssistantRefusalResponse = {
  status: Exclude<AssistantRequestStatus, "answered">;
  message: string;
  searchHref?: string;
};

export type AssistantPublicResponse =
  | AssistantAnsweredResponse
  | AssistantRefusalResponse;

export type AssistantRetrievalStatus =
  | "ok"
  | "empty"
  | "incomplete"
  | "unavailable";

export type AssistantRetrievalResult = {
  status: AssistantRetrievalStatus;
  sources: AssistantEvidenceSource[];
  chunks: AssistantEvidenceChunk[];
  /** Internal only — never serialize to clients. */
  meta: {
    candidateCount: number;
    scannedCount: number;
    generationId: string | null;
    incompleteReason?: string;
  };
};

export type AssistantEvidenceReference = {
  entityType: AssistantEntityType;
  entityId: string;
  versionId: string;
};

export type AssistantEvidenceRevalidationResult = {
  valid: boolean;
  invalidReferences: AssistantEvidenceReference[];
};

export type AssistantProviderFinishReason =
  | "completed"
  | "refused"
  | "timeout"
  | "unavailable"
  | "invalid_output"
  | "cancelled";

export type AssistantProviderResult =
  | {
      kind: "answered";
      blocks: AssistantAnswerBlock[];
      usage: AssistantUsage;
      finishReason: AssistantProviderFinishReason;
      providerStatus: "ok";
    }
  | {
      kind: "refused";
      refusalCategory: AssistantRefusalCategory;
      usage: AssistantUsage;
      finishReason: AssistantProviderFinishReason;
      providerStatus: "ok" | "unavailable" | "timeout" | "invalid";
    };
