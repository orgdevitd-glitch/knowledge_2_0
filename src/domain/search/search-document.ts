import {
  SEARCH_DOCUMENT_SCHEMA_VERSION,
  SEARCH_DOCUMENT_STATES,
  SEARCH_ENTITY_TYPES,
  type SearchDocumentState,
  type SearchEntityType,
} from "./search-limits";

export type SearchDocumentId = `${SearchEntityType}:${string}`;

export type ActiveSearchDocument = {
  id: SearchDocumentId;
  entityType: SearchEntityType;
  entityId: string;
  sourceRevision: number;
  versionId: string;
  versionNumber: number;
  state: "active";
  slug: string;
  href: string;
  title: string;
  summary: string | null;
  bodyText: string;
  promptText: string | null;
  headings: string[];
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  publishedAt: string;
  searchableText: string;
  schemaVersion: typeof SEARCH_DOCUMENT_SCHEMA_VERSION;
};

export type SearchTombstone = {
  id: SearchDocumentId;
  entityType: SearchEntityType;
  entityId: string;
  sourceRevision: number;
  state: "removed";
  schemaVersion: typeof SEARCH_DOCUMENT_SCHEMA_VERSION;
  versionId?: string | null;
  versionNumber?: number | null;
};

export type SearchDocument = ActiveSearchDocument | SearchTombstone;

export function searchDocumentId(
  entityType: SearchEntityType,
  entityId: string,
): SearchDocumentId {
  return `${entityType}:${entityId}`;
}

export function isActiveSearchDocument(
  doc: SearchDocument,
): doc is ActiveSearchDocument {
  return doc.state === "active";
}

export function isSearchTombstone(doc: SearchDocument): doc is SearchTombstone {
  return doc.state === "removed";
}

export function createSearchTombstone(input: {
  entityType: SearchEntityType;
  entityId: string;
  sourceRevision: number;
  versionId?: string | null;
  versionNumber?: number | null;
}): SearchTombstone {
  assertEntityType(input.entityType);
  assertNonNegativeRevision(input.sourceRevision);
  return {
    id: searchDocumentId(input.entityType, input.entityId),
    entityType: input.entityType,
    entityId: input.entityId,
    sourceRevision: input.sourceRevision,
    state: "removed",
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
    versionId: input.versionId ?? null,
    versionNumber: input.versionNumber ?? null,
  };
}

export function assertEntityType(value: string): asserts value is SearchEntityType {
  if (!(SEARCH_ENTITY_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Invalid search entityType: ${value}`);
  }
}

export function assertDocumentState(
  value: string,
): asserts value is SearchDocumentState {
  if (!(SEARCH_DOCUMENT_STATES as readonly string[]).includes(value)) {
    throw new Error(`Invalid search document state: ${value}`);
  }
}

function assertNonNegativeRevision(revision: number): void {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("sourceRevision must be a non-negative integer");
  }
}

/**
 * Compare active payloads for equal-revision idempotency (ignore identity noise).
 */
export function activeDocumentsEquivalent(
  a: ActiveSearchDocument,
  b: ActiveSearchDocument,
): boolean {
  return (
    a.id === b.id &&
    a.entityType === b.entityType &&
    a.entityId === b.entityId &&
    a.versionId === b.versionId &&
    a.versionNumber === b.versionNumber &&
    a.slug === b.slug &&
    a.href === b.href &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.bodyText === b.bodyText &&
    a.promptText === b.promptText &&
    a.publishedAt === b.publishedAt &&
    a.searchableText === b.searchableText &&
    arraysEqual(a.headings, b.headings) &&
    arraysEqual(a.categoryIds, b.categoryIds) &&
    arraysEqual(a.tagIds, b.tagIds) &&
    arraysEqual(a.audienceIds, b.audienceIds)
  );
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export type MutationApplyResult =
  | { outcome: "applied"; document: SearchDocument }
  | { outcome: "ignored_stale"; document: SearchDocument }
  | { outcome: "idempotent"; document: SearchDocument }
  | { outcome: "conflict"; document: SearchDocument; reason: string };

/**
 * sourceRevision guard for index mutations.
 */
export function resolveSearchMutation(
  existing: SearchDocument | null,
  incoming: SearchDocument,
): MutationApplyResult {
  if (!existing) {
    return { outcome: "applied", document: incoming };
  }
  if (incoming.sourceRevision < existing.sourceRevision) {
    return { outcome: "ignored_stale", document: existing };
  }
  if (incoming.sourceRevision > existing.sourceRevision) {
    return { outcome: "applied", document: incoming };
  }
  // Equal revision
  if (existing.state === "removed" && incoming.state === "removed") {
    return { outcome: "idempotent", document: existing };
  }
  if (
    existing.state === "active" &&
    incoming.state === "active" &&
    activeDocumentsEquivalent(existing, incoming)
  ) {
    return { outcome: "idempotent", document: existing };
  }
  if (existing.state === incoming.state) {
    return {
      outcome: "conflict",
      document: existing,
      reason: "equal_revision_payload_mismatch",
    };
  }
  return {
    outcome: "conflict",
    document: existing,
    reason: "equal_revision_state_mismatch",
  };
}
