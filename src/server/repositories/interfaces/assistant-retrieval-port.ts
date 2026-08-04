import type {
  AssistantEvidenceReference,
  AssistantEvidenceRevalidationResult,
  AssistantFilters,
  AssistantRetrievalResult,
} from "@/domain/assistant/types";

export type AssistantRetrieveRequest = {
  question: string;
  filters: AssistantFilters;
};

export interface AssistantRetrievalPort {
  retrieve(request: AssistantRetrieveRequest): Promise<AssistantRetrievalResult>;
  revalidate(
    references: readonly AssistantEvidenceReference[],
  ): Promise<AssistantEvidenceRevalidationResult>;
}
