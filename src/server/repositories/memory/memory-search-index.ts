import { randomBytes } from "node:crypto";

import {
  isActiveSearchDocument,
  resolveSearchMutation,
  type ActiveSearchDocument,
  type SearchDocument,
} from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import { checksumSearchDocuments } from "@/domain/search/search-index-validation";
import { ConflictError, RepositoryError } from "@/domain/shared/errors";
import { getSearchLimits } from "@/config/search-env";
import { rankActiveDocuments } from "@/features/search/application/rank-documents";
import type {
  SearchIndexGenerationSnapshot,
  SearchIndexManifest,
  SearchIndexMutation,
  SearchIndexMutationResult,
  SearchIndexPort,
  SearchIndexQueryInput,
  SearchIndexQueryResult,
  SearchIndexStatus,
  SearchRebuildBaseline,
  SearchReplaceGenerationResult,
} from "../interfaces/search-index-port";
import { MEMORY_REPOSITORY_MARKER } from "./memory-store";

type GenerationRecord = {
  generationId: string;
  createdAt: string;
  documents: Map<string, SearchDocument>;
};

/**
 * TEST/DEV search index with immutable generations + CAS-like manifest flips.
 *
 * Entity mutations may CAS-retry. Full rebuild MUST pass baseline and must NOT
 * blind-retry a stale candidate generation.
 */
export class MemorySearchIndexAdapter implements SearchIndexPort {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private generations = new Map<string, GenerationRecord>();
  private manifest: SearchIndexManifest | null = null;
  private manifestCasToken = 0;
  /** TEST_ONLY */
  failNextMutation: Error | null = null;
  failNextReplace: Error | null = null;
  casConflictNextWrites = 0;
  corruptCurrentGeneration = false;

  async getCurrentGeneration(): Promise<SearchIndexManifest | null> {
    return this.manifest ? { ...this.manifest } : null;
  }

  async loadGeneration(
    generationId: string,
  ): Promise<SearchIndexGenerationSnapshot | null> {
    if (this.corruptCurrentGeneration && generationId === this.manifest?.generationId) {
      throw new RepositoryError("Search generation corrupt", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    const gen = this.generations.get(generationId);
    if (!gen) return null;
    const documents = [...gen.documents.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    return {
      generationId: gen.generationId,
      createdAt: gen.createdAt,
      documents,
      activeDocuments: documents.filter(isActiveSearchDocument),
    };
  }

  async applyMutation(
    mutation: SearchIndexMutation,
  ): Promise<SearchIndexMutationResult> {
    const limits = getSearchLimits();
    let attempt = 0;
    while (attempt < limits.casMaxRetries) {
      attempt += 1;
      try {
        return await this.applyMutationOnce(mutation);
      } catch (error) {
        if (
          error instanceof ConflictError &&
          (error.details as { adminCode?: string } | undefined)?.adminCode ===
            "SEARCH_INDEX_CAS_CONFLICT" &&
          attempt < limits.casMaxRetries
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictError("Search mutation CAS retries exhausted", {
      adminCode: "SEARCH_INDEX_CAS_CONFLICT",
    });
  }

  private async applyMutationOnce(
    mutation: SearchIndexMutation,
  ): Promise<SearchIndexMutationResult> {
    if (this.failNextMutation) {
      const err = this.failNextMutation;
      this.failNextMutation = null;
      throw err;
    }

    const incoming =
      mutation.type === "upsert" ? mutation.document : mutation.document;
    const current = await this.requireOrCreateEmptyGeneration();
    const existing = current.documents.get(incoming.id) ?? null;
    const resolved = resolveSearchMutation(existing, incoming);

    if (resolved.outcome === "ignored_stale") {
      return {
        outcome: "ignored_stale",
        generationId: current.generationId,
      };
    }
    if (resolved.outcome === "idempotent") {
      return { outcome: "idempotent", generationId: current.generationId };
    }
    if (resolved.outcome === "conflict") {
      throw new ConflictError("Search index mutation conflict", {
        adminCode: "SEARCH_INDEX_CONFLICT",
        reason: resolved.reason,
      });
    }

    const nextDocs = new Map(current.documents);
    nextDocs.set(resolved.document.id, resolved.document);
    const generationId = this.newGenerationId();
    const createdAt = new Date().toISOString();
    this.generations.set(generationId, {
      generationId,
      createdAt,
      documents: nextDocs,
    });
    await this.casFlipManifest({
      generationId,
      createdAt,
      documents: nextDocs,
      previousGenerationId: current.generationId,
      expectedProviderGeneration: this.manifest?.providerGeneration ?? null,
    });
    return { outcome: "applied", generationId };
  }

  async replaceGeneration(
    documents: readonly SearchDocument[],
    baseline: SearchRebuildBaseline,
  ): Promise<SearchReplaceGenerationResult> {
    if (this.failNextReplace) {
      const err = this.failNextReplace;
      this.failNextReplace = null;
      throw err;
    }

    const currentProvider = this.manifest?.providerGeneration ?? null;
    const currentGenId = this.manifest?.generationId ?? null;
    if (
      currentProvider !== baseline.providerGeneration ||
      currentGenId !== baseline.generationId
    ) {
      throw new ConflictError(
        "Search rebuild baseline conflict — restart required",
        { adminCode: "SEARCH_INDEX_REBUILD_CONFLICT" },
      );
    }

    const map = new Map<string, SearchDocument>();
    for (const doc of documents) {
      map.set(doc.id, doc);
    }
    const generationId = this.newGenerationId();
    const createdAt = new Date().toISOString();
    this.generations.set(generationId, {
      generationId,
      createdAt,
      documents: map,
    });
    try {
      await this.casFlipManifest({
        generationId,
        createdAt,
        documents: map,
        previousGenerationId: currentGenId,
        expectedProviderGeneration: baseline.providerGeneration,
      });
    } catch (error) {
      // Orphan candidate generation remains inactive (not in manifest).
      if (error instanceof ConflictError) {
        throw new ConflictError(
          "Search rebuild CAS conflict — restart required",
          { adminCode: "SEARCH_INDEX_REBUILD_CONFLICT" },
        );
      }
      throw error;
    }
    const activeDocumentCount = [...map.values()].filter(isActiveSearchDocument)
      .length;
    return {
      generationId,
      documentCount: map.size,
      activeDocumentCount,
    };
  }

  async search(input: SearchIndexQueryInput): Promise<SearchIndexQueryResult> {
    const generationId = input.generationId ?? this.manifest?.generationId;
    if (!generationId) {
      return { generationId: "", candidates: [], hasMore: false };
    }
    if (this.corruptCurrentGeneration && generationId === this.manifest?.generationId) {
      throw new RepositoryError("Search temporarily unavailable", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    const gen = this.generations.get(generationId);
    if (!gen) {
      throw new RepositoryError("Search generation not found", {
        adminCode: "SEARCH_CURSOR_EXPIRED",
      });
    }
    const referenceTimeMs = Date.parse(gen.createdAt);
    const active = [...gen.documents.values()].filter(isActiveSearchDocument);
    const ranked = rankActiveDocuments(
      active,
      input.q,
      input.filters,
      referenceTimeMs,
    );
    let offset = 0;
    if (input.after) {
      offset = ranked.findIndex((c) => isStrictlyAfter(c, input.after!));
      if (offset < 0) offset = ranked.length;
    }
    const slice = ranked.slice(offset, offset + input.limit);
    return {
      generationId,
      candidates: slice,
      hasMore: offset + input.limit < ranked.length,
    };
  }

  async getStatus(): Promise<SearchIndexStatus> {
    if (this.corruptCurrentGeneration && this.manifest) {
      return {
        mode: "memory",
        generationId: this.manifest.generationId,
        createdAt: this.manifest.createdAt,
        documentCount: this.manifest.documentCount,
        activeDocumentCount: this.manifest.activeDocumentCount,
        previousGenerationId: this.manifest.previousGenerationId,
        validationStatus: "corrupt",
      };
    }
    if (!this.manifest) {
      return {
        mode: "memory",
        generationId: null,
        createdAt: null,
        documentCount: 0,
        activeDocumentCount: 0,
        previousGenerationId: null,
        validationStatus: "empty",
      };
    }
    return {
      mode: "memory",
      generationId: this.manifest.generationId,
      createdAt: this.manifest.createdAt,
      documentCount: this.manifest.documentCount,
      activeDocumentCount: this.manifest.activeDocumentCount,
      previousGenerationId: this.manifest.previousGenerationId,
      validationStatus: "ok",
    };
  }

  clear(): void {
    this.generations.clear();
    this.manifest = null;
    this.manifestCasToken = 0;
    this.failNextMutation = null;
    this.failNextReplace = null;
    this.casConflictNextWrites = 0;
    this.corruptCurrentGeneration = false;
  }

  /** TEST_ONLY peek generation docs */
  getDocumentsForTests(generationId?: string): SearchDocument[] {
    const id = generationId ?? this.manifest?.generationId;
    if (!id) return [];
    return [...(this.generations.get(id)?.documents.values() ?? [])];
  }

  /** TEST_ONLY — orphan generations exist but are not current */
  hasGenerationForTests(generationId: string): boolean {
    return this.generations.has(generationId);
  }

  private async requireOrCreateEmptyGeneration(): Promise<GenerationRecord> {
    if (this.manifest) {
      const gen = this.generations.get(this.manifest.generationId);
      if (!gen) {
        throw new RepositoryError("Manifest points to missing generation");
      }
      return gen;
    }
    const generationId = this.newGenerationId();
    const createdAt = new Date().toISOString();
    const documents = new Map<string, SearchDocument>();
    this.generations.set(generationId, {
      generationId,
      createdAt,
      documents,
    });
    await this.casFlipManifest({
      generationId,
      createdAt,
      documents,
      previousGenerationId: null,
      expectedProviderGeneration: null,
    });
    return this.generations.get(generationId)!;
  }

  private async casFlipManifest(input: {
    generationId: string;
    createdAt: string;
    documents: Map<string, SearchDocument>;
    previousGenerationId: string | null;
    expectedProviderGeneration: string | null;
  }): Promise<void> {
    if (this.casConflictNextWrites > 0) {
      this.casConflictNextWrites -= 1;
      throw new ConflictError("Search manifest CAS conflict", {
        adminCode: "SEARCH_INDEX_CAS_CONFLICT",
      });
    }
    const currentProvider = this.manifest?.providerGeneration ?? null;
    if (currentProvider !== input.expectedProviderGeneration) {
      throw new ConflictError("Search manifest CAS conflict", {
        adminCode: "SEARCH_INDEX_CAS_CONFLICT",
      });
    }
    const activeDocumentCount = [...input.documents.values()].filter(
      isActiveSearchDocument,
    ).length;
    this.manifestCasToken += 1;
    this.manifest = {
      schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
      generationId: input.generationId,
      createdAt: input.createdAt,
      documentCount: input.documents.size,
      activeDocumentCount,
      indexChecksum: checksumSearchDocuments([...input.documents.values()]),
      previousGenerationId: input.previousGenerationId,
      providerGeneration: String(this.manifestCasToken),
    };
  }

  private newGenerationId(): string {
    return `gen_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
  }
}

function isStrictlyAfter(
  candidate: { score: number; document: ActiveSearchDocument },
  after: {
    score: number;
    publishedAt: string;
    entityType: string;
    entityId: string;
  },
): boolean {
  if (candidate.score !== after.score) {
    return candidate.score < after.score;
  }
  const pub = candidate.document.publishedAt.localeCompare(after.publishedAt);
  if (pub !== 0) return pub < 0;
  const type = candidate.document.entityType.localeCompare(after.entityType);
  if (type !== 0) return type > 0;
  return candidate.document.entityId.localeCompare(after.entityId) > 0;
}
