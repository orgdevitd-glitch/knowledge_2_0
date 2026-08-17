import "server-only";

import { getAssistantConfig } from "@/config/assistant-env";
import {
  chunkArticleSnapshot,
  chunkPromptSnapshot,
} from "@/domain/assistant/chunking";
import { normalizeAssistantQuestion } from "@/domain/assistant/text";
import type {
  AssistantEvidenceChunk,
  AssistantEvidenceReference,
  AssistantEvidenceSource,
  AssistantFilters,
  AssistantRetrievalResult,
} from "@/domain/assistant/types";
import { RepositoryError } from "@/domain/shared/errors";
import type { PublicAssistantContentPort } from "@/server/repositories/interfaces/assistant-content-port";
import type {
  AssistantRetrieveRequest,
  AssistantRetrievalPort,
} from "@/server/repositories/interfaces/assistant-retrieval-port";
import type { PublicSearchVisibilityPort } from "@/server/repositories/interfaces/public-search-visibility-port";
import type {
  SearchIndexPort,
  SearchQueryFilters,
} from "@/server/repositories/interfaces/search-index-port";

function toSearchFilters(filters: AssistantFilters): SearchQueryFilters {
  const entityType =
    filters.type === "all"
      ? null
      : filters.type === "prompt"
        ? "prompt"
        : "article";
  return {
    entityType,
    categoryId: filters.categoryId,
    tagId: filters.tagId,
    audienceId: filters.audienceId,
  };
}

function isUnavailableError(error: unknown): boolean {
  if (!(error instanceof RepositoryError)) return false;
  const code = String(error.details?.adminCode ?? "");
  return (
    code === "SEARCH_INDEX_UNAVAILABLE" ||
    code === "SEARCH_GENERATION_CORRUPT" ||
    code === "SEARCH_GENERATION_NOT_FOUND"
  );
}

/**
 * AssistantRetrievalPort over Search Foundation + published snapshot hydration.
 * Does not call HTTP /api/search. Does not use public Search DTOs as evidence.
 */
export class SearchBackedAssistantRetrieval
  implements AssistantRetrievalPort
{
  constructor(
    private readonly index: SearchIndexPort,
    private readonly visibility: PublicSearchVisibilityPort,
    private readonly content: PublicAssistantContentPort,
  ) {}

  async retrieve(
    request: AssistantRetrieveRequest,
  ): Promise<AssistantRetrievalResult> {
    const limits = getAssistantConfig();
    const q = normalizeAssistantQuestion(request.question);
    if (!q) {
      return {
        status: "empty",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: 0,
          scannedCount: 0,
          generationId: null,
        },
      };
    }

    let searchResult;
    try {
      searchResult = await this.index.search({
        q,
        filters: toSearchFilters(request.filters),
        limit: limits.maxRetrievalCandidates,
      });
    } catch (error) {
      if (isUnavailableError(error)) {
        return {
          status: "unavailable",
          sources: [],
          chunks: [],
          meta: {
            candidateCount: 0,
            scannedCount: 0,
            generationId: null,
            incompleteReason: "index_unavailable",
          },
        };
      }
      throw error;
    }

    const candidates = searchResult.candidates;
    if (candidates.length === 0) {
      return {
        status: "empty",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: 0,
          scannedCount: 0,
          generationId: searchResult.generationId,
        },
      };
    }

    // Default scope excludes prompts even if index returned them (defense in depth).
    const scoped = candidates.filter((c) => {
      if (request.filters.type === "article") {
        return c.document.entityType === "article";
      }
      if (request.filters.type === "prompt") {
        return c.document.entityType === "prompt";
      }
      return true;
    });

    const scanLimit = Math.min(scoped.length, limits.visibilityMaxScan);
    const toScan = scoped.slice(0, scanLimit);
    /** Truncated visibility scan — cannot confirm completeness of the candidate window. */
    const incompleteBecauseScan = scoped.length > scanLimit;

    let visibilityResults;
    try {
      visibilityResults = await this.visibility.filterVisible(
        toScan.map((c) => ({
          entityType: c.document.entityType,
          entityId: c.document.entityId,
          versionId: c.document.versionId,
        })),
      );
    } catch {
      return {
        status: "unavailable",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: scoped.length,
          scannedCount: toScan.length,
          generationId: searchResult.generationId,
          incompleteReason: "visibility_unavailable",
        },
      };
    }

    const visibleKeys = new Set(
      visibilityResults
        .filter((r) => r.visible)
        .map((r) => `${r.entityType}:${r.entityId}`),
    );

    const visibleCandidates = toScan.filter((c) =>
      visibleKeys.has(`${c.document.entityType}:${c.document.entityId}`),
    );

    if (visibleCandidates.length === 0) {
      return {
        status: incompleteBecauseScan ? "incomplete" : "empty",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: scoped.length,
          scannedCount: toScan.length,
          generationId: searchResult.generationId,
          incompleteReason: incompleteBecauseScan
            ? "scan_exhaustion"
            : undefined,
        },
      };
    }

    // Deduplicate by entity, keep first (highest rank).
    const seen = new Set<string>();
    const uniqueRefs: AssistantEvidenceReference[] = [];
    for (const c of visibleCandidates) {
      const key = `${c.document.entityType}:${c.document.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueRefs.push({
        entityType: c.document.entityType,
        entityId: c.document.entityId,
        versionId: c.document.versionId,
      });
      if (uniqueRefs.length >= limits.maxSources) break;
    }

    let hydrated;
    try {
      hydrated = await this.content.loadPublishedSnapshots(uniqueRefs);
    } catch {
      return {
        status: "unavailable",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: scoped.length,
          scannedCount: toScan.length,
          generationId: searchResult.generationId,
          incompleteReason: "content_unavailable",
        },
      };
    }

    if (hydrated.some((h) => h.status === "error")) {
      return {
        status: "unavailable",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: scoped.length,
          scannedCount: toScan.length,
          generationId: searchResult.generationId,
          incompleteReason: "content_error",
        },
      };
    }

    const budget = { chars: limits.maxTotalEvidenceCharacters };
    const sources: AssistantEvidenceSource[] = [];
    const chunks: AssistantEvidenceChunk[] = [];
    let order = 0;

    for (const item of hydrated) {
      if (item.status !== "ok") continue;
      if (budget.chars <= 0) break;
      if (item.entityType === "article") {
        const built = chunkArticleSnapshot({
          entityId: item.entityId,
          versionId: item.versionId,
          title: item.title,
          href: item.href,
          publishedAt: item.publishedAt,
          snapshot: item.snapshot,
          order,
          limits,
          budgetRemaining: budget,
        });
        if (built.chunks.length === 0) continue;
        sources.push(built.source);
        chunks.push(...built.chunks);
        order += 1;
      } else {
        const built = chunkPromptSnapshot({
          entityId: item.entityId,
          versionId: item.versionId,
          title: item.title,
          href: item.href,
          publishedAt: item.publishedAt,
          snapshot: item.snapshot,
          order,
          limits,
          budgetRemaining: budget,
        });
        if (built.chunks.length === 0) continue;
        sources.push(built.source);
        chunks.push(...built.chunks);
        order += 1;
      }
    }

    if (sources.length === 0 || chunks.length === 0) {
      return {
        status: incompleteBecauseScan ? "incomplete" : "empty",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: scoped.length,
          scannedCount: toScan.length,
          generationId: searchResult.generationId,
          incompleteReason: incompleteBecauseScan
            ? "scan_exhaustion"
            : undefined,
        },
      };
    }

    // Incomplete retrieval must not be sent to provider in 8C.1.
    if (incompleteBecauseScan) {
      return {
        status: "incomplete",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: scoped.length,
          scannedCount: toScan.length,
          generationId: searchResult.generationId,
          incompleteReason: "scan_exhaustion",
        },
      };
    }

    return {
      status: "ok",
      sources,
      chunks,
      meta: {
        candidateCount: scoped.length,
        scannedCount: toScan.length,
        generationId: searchResult.generationId,
      },
    };
  }

  async revalidate(references: readonly AssistantEvidenceReference[]) {
    if (references.length === 0) {
      return { valid: true, invalidReferences: [] };
    }
    try {
      const visibility = await this.visibility.filterVisible(
        references.map((r) => ({
          entityType: r.entityType,
          entityId: r.entityId,
          versionId: r.versionId,
        })),
      );
      const visibleKeys = new Set(
        visibility
          .filter((r) => r.visible)
          .map((r) => `${r.entityType}:${r.entityId}`),
      );
      const hydrated = await this.content.loadPublishedSnapshots(references);
      const invalid: AssistantEvidenceReference[] = [];
      for (let i = 0; i < references.length; i += 1) {
        const ref = references[i]!;
        const item = hydrated.find(
          (h) =>
            h.entityType === ref.entityType &&
            h.entityId === ref.entityId &&
            h.versionId === ref.versionId,
        );
        const key = `${ref.entityType}:${ref.entityId}`;
        if (!item || item.status !== "ok" || !visibleKeys.has(key)) {
          invalid.push(ref);
        }
      }
      return { valid: invalid.length === 0, invalidReferences: invalid };
    } catch {
      return {
        valid: false,
        invalidReferences: [...references],
      };
    }
  }
}
