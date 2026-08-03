import "server-only";

import { getSearchLimits } from "@/config/search-env";
import { RepositoryError } from "@/domain/shared/errors";
import type { ContentPorts } from "@/features/content/application/ports";
import type {
  PublicSearchVisibilityCandidate,
  PublicSearchVisibilityPort,
  PublicSearchVisibilityResult,
} from "@/server/repositories/interfaces/public-search-visibility-port";

/**
 * Batch-oriented live visibility gate.
 * Fail-closed: repository errors do not make candidates public.
 */
export class ContentPortsSearchVisibility
  implements PublicSearchVisibilityPort
{
  constructor(private readonly ports: ContentPorts) {}

  async filterVisible(
    candidates: readonly PublicSearchVisibilityCandidate[],
  ): Promise<PublicSearchVisibilityResult[]> {
    if (candidates.length === 0) return [];
    const limits = getSearchLimits();
    const batchSize = limits.visibilityBatchSize;

    try {
      const articleIds = [
        ...new Set(
          candidates
            .filter((c) => c.entityType === "article")
            .map((c) => c.entityId),
        ),
      ];
      const promptIds = [
        ...new Set(
          candidates
            .filter((c) => c.entityType === "prompt")
            .map((c) => c.entityId),
        ),
      ];

      const articleMap = new Map<
        string,
        Awaited<ReturnType<ContentPorts["articles"]["getById"]>>
      >();
      const promptMap = new Map<
        string,
        Awaited<ReturnType<ContentPorts["prompts"]["getById"]>>
      >();

      for (let i = 0; i < articleIds.length; i += batchSize) {
        const chunk = articleIds.slice(i, i + batchSize);
        const rows = await Promise.all(
          chunk.map(async (id) => [id, await this.ports.articles.getById(id)] as const),
        );
        for (const [id, live] of rows) articleMap.set(id, live);
      }
      for (let i = 0; i < promptIds.length; i += batchSize) {
        const chunk = promptIds.slice(i, i + batchSize);
        const rows = await Promise.all(
          chunk.map(async (id) => [id, await this.ports.prompts.getById(id)] as const),
        );
        for (const [id, live] of rows) promptMap.set(id, live);
      }

      return candidates.map((c) => {
        if (c.entityType === "article") {
          const live = articleMap.get(c.entityId);
          const visible = Boolean(
            live &&
              live.status === "published" &&
              live.publishedVersion === c.versionId,
          );
          return {
            entityType: c.entityType,
            entityId: c.entityId,
            visible,
          };
        }
        const live = promptMap.get(c.entityId);
        const visible = Boolean(
          live &&
            live.status === "published" &&
            live.publishedVersion === c.versionId,
        );
        return {
          entityType: c.entityType,
          entityId: c.entityId,
          visible,
        };
      });
    } catch (error) {
      throw new RepositoryError("Search visibility check failed", {
        adminCode: "SEARCH_INDEX_UNAVAILABLE",
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
