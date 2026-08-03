import "server-only";

import type { ArticleSnapshot } from "@/domain/content/article";
import type { PromptSnapshot } from "@/domain/content/prompt";
import type { SearchDocument } from "@/domain/search/search-document";
import { ConflictError, ValidationError } from "@/domain/shared/errors";
import { logger } from "@/lib/logger";
import { getSearchLimits } from "@/config/search-env";
import type { ContentPorts } from "@/features/content/application/ports";
import {
  buildArticleSearchDocument,
  buildPromptSearchDocument,
  serializeSearchDocuments,
  tombstoneForEntity,
} from "@/features/search/application/build-search-document";
import {
  getSearchIndex,
  getSearchIndexFailureRepository,
} from "@/server/composition/search-ports";
import type { SearchRebuildBaseline } from "@/server/repositories/interfaces/search-index-port";
import { SequentialIdGenerator } from "@/domain/shared/id-generator";

const ids = new SequentialIdGenerator();

export type RebuildSearchIndexResult = {
  generationId: string;
  documentCount: number;
  activeDocumentCount: number;
  scannedArticles: number;
  scannedPrompts: number;
  tombstoneCount: number;
  baselineGenerationId: string | null;
};

/**
 * Full rebuild from published snapshots + minimal tombstones for
 * hidden/archived entities (preserves sourceRevision ordering guards).
 *
 * CAS contract: capture baseline before scan; flip only against that baseline;
 * on conflict abort (SEARCH_INDEX_REBUILD_CONFLICT) — never blind-retry stale candidate.
 */
export async function rebuildSearchIndex(
  ports: ContentPorts,
  options?: { requestId?: string },
): Promise<RebuildSearchIndexResult> {
  const limits = getSearchLimits();
  const index = getSearchIndex();
  const baselineManifest = await index.getCurrentGeneration();
  const baseline: SearchRebuildBaseline = {
    providerGeneration: baselineManifest?.providerGeneration ?? null,
    generationId: baselineManifest?.generationId ?? null,
  };
  logger.info("search.index.rebuild.started", {});

  try {
    const byId = new Map<string, SearchDocument>();
    let scannedArticles = 0;
    let scannedPrompts = 0;

    // Published → active documents
    await scanArticles(ports, "published", async (live) => {
      scannedArticles += 1;
      if (!live.publishedVersion) return;
      const version = await ports.versions.getById(String(live.publishedVersion));
      if (!version || version.entityType !== "article") return;
      const doc = buildArticleSearchDocument({
        live,
        snapshot: version.snapshot as ArticleSnapshot,
        versionId: version.id as string,
        versionNumber: version.versionNumber as number,
      });
      byId.set(doc.id, doc);
    });

    await scanPrompts(ports, "published", async (live) => {
      scannedPrompts += 1;
      if (!live.publishedVersion) return;
      const version = await ports.versions.getById(String(live.publishedVersion));
      if (!version || version.entityType !== "prompt") return;
      const doc = buildPromptSearchDocument({
        live,
        snapshot: version.snapshot as PromptSnapshot,
        versionId: version.id as string,
        versionNumber: version.versionNumber as number,
      });
      byId.set(doc.id, doc);
    });

    // Hidden/archived → tombstones (ordering guard against delayed stale upserts)
    for (const status of ["hidden", "archived"] as const) {
      await scanArticles(ports, status, async (live) => {
        scannedArticles += 1;
        const tombstone = tombstoneForEntity({
          entityType: "article",
          entityId: live.id as string,
          sourceRevision: live.revision as number,
          versionId: live.publishedVersion,
        });
        const existing = byId.get(tombstone.id);
        if (!existing || existing.sourceRevision <= tombstone.sourceRevision) {
          byId.set(tombstone.id, tombstone);
        }
      });
      await scanPrompts(ports, status, async (live) => {
        scannedPrompts += 1;
        const tombstone = tombstoneForEntity({
          entityType: "prompt",
          entityId: live.id as string,
          sourceRevision: live.revision as number,
          versionId: live.publishedVersion,
        });
        const existing = byId.get(tombstone.id);
        if (!existing || existing.sourceRevision <= tombstone.sourceRevision) {
          byId.set(tombstone.id, tombstone);
        }
      });
    }

    const documents = [...byId.values()];
    if (documents.length > limits.maxDocuments) {
      throw new ValidationError("Rebuild exceeds max documents", {
        adminCode: "SEARCH_INDEX_TOO_LARGE",
        maxDocuments: limits.maxDocuments,
      });
    }
    const serialized = serializeSearchDocuments(documents);
    if (Buffer.byteLength(serialized, "utf8") > limits.maxIndexBytes) {
      throw new ValidationError("Rebuild exceeds max index bytes", {
        adminCode: "SEARCH_INDEX_TOO_LARGE",
        maxIndexBytes: limits.maxIndexBytes,
      });
    }

    // Re-check baseline immediately before flip (defense in depth).
    const latest = await index.getCurrentGeneration();
    if (
      (latest?.providerGeneration ?? null) !== baseline.providerGeneration ||
      (latest?.generationId ?? null) !== baseline.generationId
    ) {
      throw new ConflictError(
        "Search rebuild conflict — restart required",
        { adminCode: "SEARCH_INDEX_REBUILD_CONFLICT" },
      );
    }

    const result = await index.replaceGeneration(documents, baseline);
    const tombstoneCount = documents.filter((d) => d.state === "removed").length;
    logger.info("search.index.rebuild.completed", {
      documentCount: result.documentCount,
    });
    return {
      ...result,
      scannedArticles,
      scannedPrompts,
      tombstoneCount,
      baselineGenerationId: baseline.generationId,
    };
  } catch (error) {
    const code =
      error instanceof ValidationError || error instanceof ConflictError
        ? String(
            (error.details as { adminCode?: string } | undefined)?.adminCode ??
              "REBUILD_FAILED",
          )
        : "REBUILD_FAILED";
    logger.warn("search.index.rebuild.failed", { failureCode: code });
    try {
      const now = new Date().toISOString();
      await getSearchIndexFailureRepository().save({
        id: ids.next("searchfail"),
        entityType: "index",
        entityId: "rebuild",
        operation: "rebuild",
        sourceRevision: 0,
        versionId: null,
        failureCode: code.slice(0, 64),
        occurredAt: now,
        updatedAt: now,
        attemptCount: 1,
        resolvedAt: null,
        requestId: options?.requestId ?? null,
      });
    } catch {
      /* ignore */
    }
    throw error;
  }
}

async function scanArticles(
  ports: ContentPorts,
  status: "published" | "hidden" | "archived",
  onItem: (live: Awaited<ReturnType<ContentPorts["articles"]["getById"]>> & object) => Promise<void>,
): Promise<void> {
  const limits = getSearchLimits();
  let cursor: string | null = null;
  let pages = 0;
  const seenCursors = new Set<string>();
  do {
    pages += 1;
    if (pages > limits.rebuildMaxPages) {
      throw new ValidationError("Rebuild article pagination exceeded max pages", {
        adminCode: "SEARCH_INDEX_REBUILD_LOOP",
      });
    }
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new ValidationError("Rebuild article cursor loop detected", {
          adminCode: "SEARCH_INDEX_REBUILD_LOOP",
        });
      }
      seenCursors.add(cursor);
    }
    const page = await ports.articles.list(
      { status },
      { limit: limits.rebuildPageSize, cursor },
    );
    for (const live of page.items) {
      await onItem(live);
    }
    cursor = page.nextCursor;
  } while (cursor);
}

async function scanPrompts(
  ports: ContentPorts,
  status: "published" | "hidden" | "archived",
  onItem: (live: Awaited<ReturnType<ContentPorts["prompts"]["getById"]>> & object) => Promise<void>,
): Promise<void> {
  const limits = getSearchLimits();
  let cursor: string | null = null;
  let pages = 0;
  const seenCursors = new Set<string>();
  do {
    pages += 1;
    if (pages > limits.rebuildMaxPages) {
      throw new ValidationError("Rebuild prompt pagination exceeded max pages", {
        adminCode: "SEARCH_INDEX_REBUILD_LOOP",
      });
    }
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new ValidationError("Rebuild prompt cursor loop detected", {
          adminCode: "SEARCH_INDEX_REBUILD_LOOP",
        });
      }
      seenCursors.add(cursor);
    }
    const page = await ports.prompts.list(
      { status },
      { limit: limits.rebuildPageSize, cursor },
    );
    for (const live of page.items) {
      await onItem(live);
    }
    cursor = page.nextCursor;
  } while (cursor);
}
