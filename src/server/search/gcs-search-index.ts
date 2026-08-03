import "server-only";

import { randomBytes } from "node:crypto";

import { getSearchLimits } from "@/config/search-env";
import {
  isActiveSearchDocument,
  resolveSearchMutation,
  type SearchDocument,
} from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import {
  assertSearchGenerationId,
  checksumSearchDocuments,
  parseAndValidateSearchGenerationPayload,
  parseAndValidateSearchManifest,
} from "@/domain/search/search-index-validation";
import {
  ConflictError,
  RepositoryError,
  ValidationError,
} from "@/domain/shared/errors";
import { rankActiveDocuments } from "@/features/search/application/rank-documents";
import { getFirebaseAdminStorage } from "@/server/firebase/admin";
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
} from "@/server/repositories/interfaces/search-index-port";

type CachedGeneration = {
  snapshot: SearchIndexGenerationSnapshot;
  loadedAt: number;
};

type CachedManifest = {
  manifest: SearchIndexManifest;
  loadedAt: number;
};

/**
 * Private GCS durable search index (immutable generations + CAS manifest).
 *
 * - Entity mutation: CAS retry against current generation (re-apply mutation).
 * - Full rebuild: single flip against baseline captured before scan; no stale retry.
 */
export class GcsSearchIndexAdapter implements SearchIndexPort {
  private manifestCache: CachedManifest | null = null;
  private generationCache = new Map<string, CachedGeneration>();
  private lastValidationStatus: SearchIndexStatus["validationStatus"] = "empty";

  constructor(private readonly bucketName?: string) {}

  private bucket() {
    const limits = getSearchLimits();
    const name = this.bucketName ?? limits.bucketName;
    if (!name) {
      throw new RepositoryError("Search GCS bucket is not configured", {
        adminCode: "SEARCH_INDEX_UNAVAILABLE",
      });
    }
    return getFirebaseAdminStorage().bucket(name);
  }

  private prefix(): string {
    return getSearchLimits().indexPrefix;
  }

  private manifestPath(): string {
    return `${this.prefix()}/manifest.json`;
  }

  private generationPath(generationId: string): string {
    return `${this.prefix()}/generations/${assertSearchGenerationId(generationId)}/index.json`;
  }

  async getCurrentGeneration(): Promise<SearchIndexManifest | null> {
    return this.readManifest();
  }

  async loadGeneration(
    generationId: string,
  ): Promise<SearchIndexGenerationSnapshot | null> {
    const limits = getSearchLimits();
    assertSearchGenerationId(generationId);
    const cached = this.generationCache.get(generationId);
    if (
      cached &&
      Date.now() - cached.loadedAt < limits.generationCacheTtlSeconds * 1000
    ) {
      return cached.snapshot;
    }
    try {
      const file = this.bucket().file(this.generationPath(generationId));
      const [exists] = await file.exists();
      if (!exists) return null;
      const [metadata] = await file.getMetadata();
      const sizeBytes = Number(metadata.size ?? 0);
      if (sizeBytes > limits.maxIndexBytes) {
        this.lastValidationStatus = "corrupt";
        throw new RepositoryError("Search generation oversized", {
          adminCode: "SEARCH_INDEX_CORRUPT",
        });
      }
      const [buf] = await file.download();
      let parsed: unknown;
      try {
        parsed = JSON.parse(buf.toString("utf8"));
      } catch {
        this.lastValidationStatus = "corrupt";
        throw new RepositoryError("Search generation malformed JSON", {
          adminCode: "SEARCH_INDEX_CORRUPT",
        });
      }
      const manifest = await this.readManifest();
      const validated = parseAndValidateSearchGenerationPayload({
        raw: parsed,
        expectedGenerationId: generationId,
        expectedChecksum:
          manifest?.generationId === generationId
            ? manifest.indexChecksum
            : null,
        expectedDocumentCount:
          manifest?.generationId === generationId
            ? manifest.documentCount
            : undefined,
        expectedActiveCount:
          manifest?.generationId === generationId
            ? manifest.activeDocumentCount
            : undefined,
        maxDocuments: limits.maxDocuments,
      });
      const snapshot: SearchIndexGenerationSnapshot = {
        generationId: validated.generationId,
        createdAt: validated.createdAt,
        documents: validated.documents,
        activeDocuments: validated.documents.filter(isActiveSearchDocument),
      };
      this.generationCache.set(generationId, {
        snapshot,
        loadedAt: Date.now(),
      });
      this.lastValidationStatus = "ok";
      return snapshot;
    } catch (error) {
      if (error instanceof RepositoryError || error instanceof ValidationError) {
        if (
          (error.details as { adminCode?: string } | undefined)?.adminCode ===
          "SEARCH_INDEX_CORRUPT"
        ) {
          this.lastValidationStatus = "corrupt";
        }
        throw error instanceof RepositoryError
          ? error
          : new RepositoryError(error.message, {
              adminCode: "SEARCH_INDEX_CORRUPT",
            });
      }
      this.lastValidationStatus = "unavailable";
      throw new RepositoryError("Failed to load search generation", {
        adminCode: "SEARCH_INDEX_UNAVAILABLE",
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
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
          this.manifestCache = null;
          continue;
        }
        throw error;
      }
    }
    throw new ConflictError("Search manifest CAS retries exhausted", {
      adminCode: "SEARCH_INDEX_CAS_CONFLICT",
    });
  }

  private async applyMutationOnce(
    mutation: SearchIndexMutation,
  ): Promise<SearchIndexMutationResult> {
    const incoming =
      mutation.type === "upsert" ? mutation.document : mutation.document;
    const manifest = await this.readManifest();
    let existingDocs: SearchDocument[] = [];
    let previousGenerationId: string | null = null;
    if (manifest) {
      const gen = await this.loadGeneration(manifest.generationId);
      existingDocs = gen?.documents ?? [];
      previousGenerationId = manifest.generationId;
    }
    const byId = new Map(existingDocs.map((d) => [d.id, d]));
    const existing = byId.get(incoming.id) ?? null;
    const resolved = resolveSearchMutation(existing, incoming);
    if (resolved.outcome === "ignored_stale") {
      return {
        outcome: "ignored_stale",
        generationId: manifest?.generationId ?? "",
      };
    }
    if (resolved.outcome === "idempotent") {
      return {
        outcome: "idempotent",
        generationId: manifest?.generationId ?? "",
      };
    }
    if (resolved.outcome === "conflict") {
      throw new ConflictError("Search index mutation conflict", {
        adminCode: "SEARCH_INDEX_CONFLICT",
        reason: resolved.reason,
      });
    }
    byId.set(resolved.document.id, resolved.document);
    const nextDocs = [...byId.values()];
    const generationId = this.newGenerationId();
    const createdAt = new Date().toISOString();
    await this.writeGenerationImmutable(generationId, createdAt, nextDocs);
    await this.casWriteManifest({
      generationId,
      createdAt,
      documents: nextDocs,
      previousGenerationId,
      expectedProviderGeneration: manifest?.providerGeneration ?? null,
    });
    return { outcome: "applied", generationId };
  }

  async replaceGeneration(
    documents: readonly SearchDocument[],
    baseline: SearchRebuildBaseline,
  ): Promise<SearchReplaceGenerationResult> {
    const manifest = await this.readManifest();
    const currentProvider = manifest?.providerGeneration ?? null;
    const currentGenId = manifest?.generationId ?? null;
    if (
      currentProvider !== baseline.providerGeneration ||
      currentGenId !== baseline.generationId
    ) {
      throw new ConflictError(
        "Search rebuild baseline conflict — restart required",
        { adminCode: "SEARCH_INDEX_REBUILD_CONFLICT" },
      );
    }

    const generationId = this.newGenerationId();
    const createdAt = new Date().toISOString();
    const docs = [...documents];
    await this.writeGenerationImmutable(generationId, createdAt, docs);
    try {
      await this.casWriteManifest({
        generationId,
        createdAt,
        documents: docs,
        previousGenerationId: currentGenId,
        expectedProviderGeneration: baseline.providerGeneration,
      });
    } catch (error) {
      // Orphan generation remains inactive. Do NOT retry with same candidate.
      if (
        error instanceof ConflictError &&
        (error.details as { adminCode?: string } | undefined)?.adminCode ===
          "SEARCH_INDEX_CAS_CONFLICT"
      ) {
        throw new ConflictError(
          "Search rebuild CAS conflict — restart required",
          { adminCode: "SEARCH_INDEX_REBUILD_CONFLICT" },
        );
      }
      throw error;
    }
    const activeDocumentCount = docs.filter(isActiveSearchDocument).length;
    return {
      generationId,
      documentCount: docs.length,
      activeDocumentCount,
    };
  }

  async search(input: SearchIndexQueryInput): Promise<SearchIndexQueryResult> {
    const manifest = await this.readManifest();
    const generationId = input.generationId ?? manifest?.generationId;
    if (!generationId) {
      return { generationId: "", candidates: [], hasMore: false };
    }
    let gen: SearchIndexGenerationSnapshot | null;
    try {
      gen = await this.loadGeneration(generationId);
    } catch (error) {
      if (
        error instanceof RepositoryError &&
        (error.details as { adminCode?: string } | undefined)?.adminCode ===
          "SEARCH_INDEX_CORRUPT"
      ) {
        // No silent fallback to previousGenerationId.
        throw new RepositoryError("Search temporarily unavailable", {
          adminCode: "SEARCH_INDEX_UNAVAILABLE",
        });
      }
      throw error;
    }
    if (!gen) {
      throw new RepositoryError("Search generation not found", {
        adminCode: "SEARCH_CURSOR_EXPIRED",
      });
    }
    const referenceTimeMs = Date.parse(gen.createdAt);
    const ranked = rankActiveDocuments(
      gen.activeDocuments,
      input.q,
      input.filters,
      referenceTimeMs,
    );
    let offset = 0;
    if (input.after) {
      offset = ranked.findIndex((c) => {
        if (c.score !== input.after!.score) return c.score < input.after!.score;
        const pub = c.document.publishedAt.localeCompare(
          input.after!.publishedAt,
        );
        if (pub !== 0) return pub < 0;
        const type = c.document.entityType.localeCompare(
          input.after!.entityType,
        );
        if (type !== 0) return type > 0;
        return c.document.entityId.localeCompare(input.after!.entityId) > 0;
      });
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
    try {
      const manifest = await this.readManifest();
      if (!manifest) {
        return {
          mode: "gcs",
          generationId: null,
          createdAt: null,
          documentCount: 0,
          activeDocumentCount: 0,
          previousGenerationId: null,
          validationStatus: "empty",
        };
      }
      // Validate current generation without exposing internals.
      await this.loadGeneration(manifest.generationId);
      return {
        mode: "gcs",
        generationId: manifest.generationId,
        createdAt: manifest.createdAt,
        documentCount: manifest.documentCount,
        activeDocumentCount: manifest.activeDocumentCount,
        previousGenerationId: manifest.previousGenerationId,
        validationStatus: "ok",
      };
    } catch (error) {
      const code = (error as { details?: { adminCode?: string } })?.details
        ?.adminCode;
      return {
        mode: "gcs",
        generationId: this.manifestCache?.manifest.generationId ?? null,
        createdAt: this.manifestCache?.manifest.createdAt ?? null,
        documentCount: this.manifestCache?.manifest.documentCount ?? 0,
        activeDocumentCount:
          this.manifestCache?.manifest.activeDocumentCount ?? 0,
        previousGenerationId:
          this.manifestCache?.manifest.previousGenerationId ?? null,
        validationStatus:
          code === "SEARCH_INDEX_CORRUPT" ? "corrupt" : "unavailable",
      };
    }
  }

  private async readManifest(): Promise<SearchIndexManifest | null> {
    const limits = getSearchLimits();
    if (
      this.manifestCache &&
      Date.now() - this.manifestCache.loadedAt < limits.cacheTtlSeconds * 1000
    ) {
      return this.manifestCache.manifest;
    }
    try {
      const file = this.bucket().file(this.manifestPath());
      const [exists] = await file.exists();
      if (!exists) {
        this.manifestCache = null;
        this.lastValidationStatus = "empty";
        return null;
      }
      const [buf] = await file.download();
      const [metadata] = await file.getMetadata();
      let parsed: unknown;
      try {
        parsed = JSON.parse(buf.toString("utf8"));
      } catch {
        this.lastValidationStatus = "corrupt";
        throw new RepositoryError("Search manifest malformed JSON", {
          adminCode: "SEARCH_INDEX_CORRUPT",
        });
      }
      const validated = parseAndValidateSearchManifest(parsed, {
        maxDocuments: limits.maxDocuments,
      });
      const manifest: SearchIndexManifest = {
        ...validated,
        providerGeneration:
          metadata.generation != null ? String(metadata.generation) : null,
      };
      this.manifestCache = { manifest, loadedAt: Date.now() };
      return manifest;
    } catch (error) {
      if (error instanceof RepositoryError || error instanceof ValidationError) {
        throw error instanceof RepositoryError
          ? error
          : new RepositoryError(error.message, {
              adminCode: "SEARCH_INDEX_CORRUPT",
            });
      }
      throw new RepositoryError("Failed to read search manifest", {
        adminCode: "SEARCH_INDEX_UNAVAILABLE",
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async writeGenerationImmutable(
    generationId: string,
    createdAt: string,
    documents: SearchDocument[],
  ): Promise<void> {
    const limits = getSearchLimits();
    if (documents.length > limits.maxDocuments) {
      throw new RepositoryError("Search index exceeds max documents", {
        adminCode: "SEARCH_INDEX_TOO_LARGE",
      });
    }
    const body = JSON.stringify({
      schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
      generationId,
      createdAt,
      documents: [...documents].sort((a, b) => a.id.localeCompare(b.id)),
    });
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > limits.maxIndexBytes) {
      throw new RepositoryError("Search index exceeds max bytes", {
        adminCode: "SEARCH_INDEX_TOO_LARGE",
      });
    }
    try {
      const file = this.bucket().file(this.generationPath(generationId));
      await file.save(body, {
        contentType: "application/json",
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (error) {
      throw new RepositoryError("Failed to write search generation", {
        adminCode: "SEARCH_INDEX_WRITE_FAILED",
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async casWriteManifest(input: {
    generationId: string;
    createdAt: string;
    documents: SearchDocument[];
    previousGenerationId: string | null;
    expectedProviderGeneration: string | null;
  }): Promise<void> {
    const activeDocumentCount = input.documents.filter(isActiveSearchDocument)
      .length;
    const manifest: SearchIndexManifest = {
      schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
      generationId: input.generationId,
      createdAt: input.createdAt,
      documentCount: input.documents.length,
      activeDocumentCount,
      indexChecksum: checksumSearchDocuments(input.documents),
      previousGenerationId: input.previousGenerationId,
      providerGeneration: null,
    };
    const body = JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      generationId: manifest.generationId,
      createdAt: manifest.createdAt,
      documentCount: manifest.documentCount,
      activeDocumentCount: manifest.activeDocumentCount,
      indexChecksum: manifest.indexChecksum,
      previousGenerationId: manifest.previousGenerationId,
    });
    try {
      const file = this.bucket().file(this.manifestPath());
      const preconditionOpts =
        input.expectedProviderGeneration == null
          ? { ifGenerationMatch: 0 }
          : {
              ifGenerationMatch: Number(input.expectedProviderGeneration),
            };
      await file.save(body, {
        contentType: "application/json",
        resumable: false,
        preconditionOpts,
      });
      this.manifestCache = null;
      this.generationCache.clear();
      this.lastValidationStatus = "ok";
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/condition|precondition|412/i.test(message)) {
        throw new ConflictError("Search manifest CAS conflict", {
          adminCode: "SEARCH_INDEX_CAS_CONFLICT",
        });
      }
      throw new RepositoryError("Failed to write search manifest", {
        adminCode: "SEARCH_INDEX_WRITE_FAILED",
        cause: message || "unknown",
      });
    }
  }

  private newGenerationId(): string {
    return `gen_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
  }
}
