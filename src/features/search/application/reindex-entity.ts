import "server-only";

import type { ArticleSnapshot } from "@/domain/content/article";
import type { PromptSnapshot } from "@/domain/content/prompt";
import type { ContentPorts } from "@/features/content/application/ports";
import {
  buildArticleSearchDocument,
  buildPromptSearchDocument,
  tombstoneForEntity,
} from "@/features/search/application/build-search-document";
import {
  getSearchIndex,
  getSearchIndexFailureRepository,
} from "@/server/composition/search-ports";
import { logger } from "@/lib/logger";

/**
 * Reindex from authoritative content state. Never invents artificial revisions
 * for missing entities — returns not_found without index mutation.
 */
export async function reindexSearchEntity(
  ports: ContentPorts,
  input: {
    entityType: "article" | "prompt";
    entityId: string;
    requestId?: string;
  },
): Promise<{ outcome: "upserted" | "removed" | "not_found" }> {
  const startedAt = new Date().toISOString();

  if (input.entityType === "article") {
    const article = await ports.articles.getById(input.entityId);
    if (!article) {
      return { outcome: "not_found" };
    }
    let processedRevision = article.revision as number;
    if (article.status === "published" && article.publishedVersion) {
      const version = await ports.versions.getById(
        String(article.publishedVersion),
      );
      if (!version) {
        return { outcome: "not_found" };
      }
      const doc = buildArticleSearchDocument({
        live: article,
        snapshot: version.snapshot as ArticleSnapshot,
        versionId: version.id as string,
        versionNumber: version.versionNumber as number,
      });
      await getSearchIndex().applyMutation({ type: "upsert", document: doc });
      processedRevision = doc.sourceRevision;
      await resolveCovered(input.entityType, input.entityId, processedRevision, startedAt);
      return { outcome: "upserted" };
    }
    const tombstone = tombstoneForEntity({
      entityType: "article",
      entityId: input.entityId,
      sourceRevision: article.revision as number,
      versionId: article.publishedVersion,
    });
    await getSearchIndex().applyMutation({
      type: "remove",
      document: tombstone,
    });
    await resolveCovered(input.entityType, input.entityId, processedRevision, startedAt);
    return { outcome: "removed" };
  }

  const prompt = await ports.prompts.getById(input.entityId);
  if (!prompt) {
    return { outcome: "not_found" };
  }
  let processedRevision = prompt.revision as number;
  if (prompt.status === "published" && prompt.publishedVersion) {
    const version = await ports.versions.getById(String(prompt.publishedVersion));
    if (!version) {
      return { outcome: "not_found" };
    }
    const doc = buildPromptSearchDocument({
      live: prompt,
      snapshot: version.snapshot as PromptSnapshot,
      versionId: version.id as string,
      versionNumber: version.versionNumber as number,
    });
    await getSearchIndex().applyMutation({ type: "upsert", document: doc });
    processedRevision = doc.sourceRevision;
    await resolveCovered(input.entityType, input.entityId, processedRevision, startedAt);
    return { outcome: "upserted" };
  }
  const tombstone = tombstoneForEntity({
    entityType: "prompt",
    entityId: input.entityId,
    sourceRevision: prompt.revision as number,
    versionId: prompt.publishedVersion,
  });
  await getSearchIndex().applyMutation({
    type: "remove",
    document: tombstone,
  });
  await resolveCovered(input.entityType, input.entityId, processedRevision, startedAt);
  return { outcome: "removed" };
}

async function resolveCovered(
  entityType: "article" | "prompt",
  entityId: string,
  sourceRevision: number,
  startedAt: string,
): Promise<void> {
  try {
    const repo = getSearchIndexFailureRepository();
    const open = await repo.listOpenForEntity(entityType, entityId);
    const now = new Date().toISOString();
    for (const failure of open) {
      if (failure.sourceRevision > sourceRevision) continue;
      if (failure.occurredAt > startedAt) continue;
      await repo.save({ ...failure, resolvedAt: now, updatedAt: now });
    }
  } catch {
    logger.warn("search.index.failure.resolve_failed", { entityType });
  }
}
