import "server-only";

import { getSearchLimits } from "@/config/search-env";
import { getPersistenceMode } from "@/config/env";
import { RepositoryError } from "@/domain/shared/errors";
import type { SearchIndexPort } from "@/server/repositories/interfaces/search-index-port";
import type { SearchIndexFailureRepository } from "@/server/repositories/interfaces/search-index-failure-repository";
import type { PublicSearchVisibilityPort } from "@/server/repositories/interfaces/public-search-visibility-port";
import { MemorySearchIndexAdapter } from "@/server/repositories/memory/memory-search-index";
import { MemorySearchIndexFailureRepository } from "@/server/repositories/memory/memory-search-index-failure-repository";
import { FirestoreSearchIndexFailureRepository } from "@/server/repositories/firestore/firestore-search-index-failure-repository";
import { GcsSearchIndexAdapter } from "@/server/search/gcs-search-index";
import { ContentPortsSearchVisibility } from "@/server/search/public-search-visibility";
import { getContentPorts } from "@/server/composition/content-ports";

let memoryIndex: MemorySearchIndexAdapter | null = null;
let memoryFailures: MemorySearchIndexFailureRepository | null = null;
let gcsIndex: GcsSearchIndexAdapter | null = null;

export function getSearchIndex(): SearchIndexPort {
  const limits = getSearchLimits();
  if (limits.indexMode === "memory") {
    memoryIndex ??= new MemorySearchIndexAdapter();
    return memoryIndex;
  }
  if (!limits.bucketName) {
    throw new RepositoryError("Search index bucket is not configured", {
      adminCode: "SEARCH_INDEX_UNAVAILABLE",
    });
  }
  gcsIndex ??= new GcsSearchIndexAdapter(limits.bucketName);
  return gcsIndex;
}

export function getSearchIndexFailureRepository(): SearchIndexFailureRepository {
  if (getPersistenceMode() === "memory") {
    memoryFailures ??= new MemorySearchIndexFailureRepository();
    return memoryFailures;
  }
  return new FirestoreSearchIndexFailureRepository();
}

export function getPublicSearchVisibility(): PublicSearchVisibilityPort {
  return new ContentPortsSearchVisibility(getContentPorts());
}

export function getMemorySearchIndexForTests(): MemorySearchIndexAdapter {
  memoryIndex ??= new MemorySearchIndexAdapter();
  return memoryIndex;
}

export function getMemorySearchFailuresForTests(): MemorySearchIndexFailureRepository {
  memoryFailures ??= new MemorySearchIndexFailureRepository();
  return memoryFailures;
}

export function resetSearchCompositionForTests(): void {
  memoryIndex?.clear();
  memoryFailures?.clear();
  memoryIndex = null;
  memoryFailures = null;
  gcsIndex = null;
}
