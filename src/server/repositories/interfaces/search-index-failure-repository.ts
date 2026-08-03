export type SearchIndexFailureOperation =
  | "upsert"
  | "remove"
  | "rebuild"
  | "reindex";

export type SearchIndexFailure = {
  id: string;
  entityType: "article" | "prompt" | "index";
  entityId: string;
  operation: SearchIndexFailureOperation;
  sourceRevision: number;
  versionId: string | null;
  failureCode: string;
  occurredAt: string;
  updatedAt: string;
  attemptCount: number;
  resolvedAt: string | null;
  requestId: string | null;
};

export interface SearchIndexFailureRepository {
  getById(id: string): Promise<SearchIndexFailure | null>;
  save(failure: SearchIndexFailure): Promise<void>;
  listUnresolved(limit: number): Promise<SearchIndexFailure[]>;
  findOpenForEntity(
    entityType: "article" | "prompt",
    entityId: string,
  ): Promise<SearchIndexFailure | null>;
  listOpenForEntity(
    entityType: "article" | "prompt",
    entityId: string,
  ): Promise<SearchIndexFailure[]>;
}
