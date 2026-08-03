import type {
  ActiveSearchDocument,
  SearchDocument,
} from "@/domain/search/search-document";
import type { SearchEntityType } from "@/domain/search/search-limits";

export type SearchIndexManifest = {
  schemaVersion: number;
  generationId: string;
  createdAt: string;
  documentCount: number;
  activeDocumentCount: number;
  indexChecksum: string | null;
  previousGenerationId: string | null;
  /** Provider object generation for CAS (string, never JS number). */
  providerGeneration: string | null;
};

export type SearchIndexStatus = {
  mode: "memory" | "gcs";
  generationId: string | null;
  createdAt: string | null;
  documentCount: number;
  activeDocumentCount: number;
  previousGenerationId: string | null;
  /** ok | corrupt | unavailable — never exposes provider internals. */
  validationStatus: "ok" | "corrupt" | "unavailable" | "empty";
};

export type SearchIndexMutation =
  | { type: "upsert"; document: ActiveSearchDocument }
  | { type: "remove"; document: SearchDocument & { state: "removed" } };

export type SearchIndexMutationResult = {
  outcome: "applied" | "ignored_stale" | "idempotent" | "conflict";
  generationId: string;
  reason?: string;
};

export type SearchQueryFilters = {
  entityType?: SearchEntityType | null;
  categoryId?: string | null;
  tagId?: string | null;
  audienceId?: string | null;
};

export type RankedSearchCandidate = {
  document: ActiveSearchDocument;
  score: number;
};

export type SearchIndexQueryInput = {
  q: string;
  filters: SearchQueryFilters;
  limit: number;
  /** Exclusive lower bound for pagination within the same generation. */
  after?: {
    score: number;
    publishedAt: string;
    entityType: SearchEntityType;
    entityId: string;
  } | null;
  generationId?: string | null;
};

export type SearchIndexQueryResult = {
  generationId: string;
  candidates: RankedSearchCandidate[];
  /** True when more candidates may exist after this page (before visibility). */
  hasMore: boolean;
};

export type SearchIndexGenerationSnapshot = {
  generationId: string;
  createdAt: string;
  documents: SearchDocument[];
  activeDocuments: ActiveSearchDocument[];
};

/**
 * Baseline observed before rebuild scan. Manifest flip MUST use this exact
 * provider generation — never blind-retry with a stale rebuild candidate.
 */
export type SearchRebuildBaseline = {
  providerGeneration: string | null;
  generationId: string | null;
};

export type SearchReplaceGenerationResult = {
  generationId: string;
  documentCount: number;
  activeDocumentCount: number;
};

export interface SearchIndexPort {
  getCurrentGeneration(): Promise<SearchIndexManifest | null>;
  loadGeneration(
    generationId: string,
  ): Promise<SearchIndexGenerationSnapshot | null>;
  /**
   * Entity mutation: may CAS-retry against the latest current generation,
   * re-applying the same mutation after re-read.
   */
  applyMutation(
    mutation: SearchIndexMutation,
  ): Promise<SearchIndexMutationResult>;
  /**
   * Full rebuild flip: NO retry with the same candidate documents.
   * Must CAS against the baseline captured before the scan started.
   * On conflict → SEARCH_INDEX_REBUILD_CONFLICT (restart-required).
   */
  replaceGeneration(
    documents: readonly SearchDocument[],
    baseline: SearchRebuildBaseline,
  ): Promise<SearchReplaceGenerationResult>;
  search(input: SearchIndexQueryInput): Promise<SearchIndexQueryResult>;
  getStatus(): Promise<SearchIndexStatus>;
}
