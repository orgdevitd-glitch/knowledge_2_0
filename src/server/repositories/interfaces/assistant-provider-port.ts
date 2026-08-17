import type {
  AssistantFilters,
  AssistantProviderEvidence,
  AssistantProviderResult,
} from "@/domain/assistant/types";

export type AssistantProviderGenerateRequest = {
  normalizedQuestion: string;
  filtersSummary: AssistantFilters;
  evidence: readonly AssistantProviderEvidence[];
  systemPolicyVersion: string;
  locale: string;
  maximumAnswerBlocks: number;
  maximumAnswerCharacters: number;
  /** Structural contract reminder for adapters — no provider-specific objects. */
  outputSchema: "grounded_blocks_v1";
};

export interface AssistantProviderPort {
  generateGroundedAnswer(
    request: AssistantProviderGenerateRequest,
    signal: AbortSignal,
  ): Promise<AssistantProviderResult>;
}
