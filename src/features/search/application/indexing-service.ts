import "server-only";

import { toArticleSnapshot } from "@/domain/content/article";
import { toPromptSnapshot } from "@/domain/content/prompt";
import type { ContentVersion } from "@/domain/content/versioning";
import { logger } from "@/lib/logger";
import {
  buildArticleSearchDocument,
  buildPromptSearchDocument,
  tombstoneForEntity,
} from "@/features/search/application/build-search-document";
import type { ContentPorts } from "@/features/content/application/ports";
import {
  getSearchIndex,
  getSearchIndexFailureRepository,
} from "@/server/composition/search-ports";
import type { SearchIndexFailure } from "@/server/repositories/interfaces/search-index-failure-repository";
import { SequentialIdGenerator } from "@/domain/shared/id-generator";

const ids = new SequentialIdGenerator();

async function recordFailure(input: {
  entityType: "article" | "prompt" | "index";
  entityId: string;
  operation: SearchIndexFailure["operation"];
  sourceRevision: number;
  versionId?: string | null;
  failureCode: string;
  requestId?: string | null;
}): Promise<void> {
  try {
    const repo = getSearchIndexFailureRepository();
    const now = new Date().toISOString();
    const existing =
      input.entityType === "article" || input.entityType === "prompt"
        ? await repo.findOpenForEntity(input.entityType, input.entityId)
        : null;
    const failure: SearchIndexFailure = {
      id: existing?.id ?? ids.next("searchfail"),
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      sourceRevision: input.sourceRevision,
      versionId: input.versionId ?? null,
      failureCode: input.failureCode.slice(0, 64),
      occurredAt: existing?.occurredAt ?? now,
      updatedAt: now,
      attemptCount: (existing?.attemptCount ?? 0) + 1,
      resolvedAt: null,
      requestId: input.requestId ?? null,
    };
    await repo.save(failure);
  } catch {
    logger.warn("search.index.failure.record_failed", {
      failureCode: input.failureCode,
      entityType: input.entityType,
    });
  }
}

async function resolveCoveredFailures(input: {
  entityType: "article" | "prompt";
  entityId: string;
  sourceRevision: number;
  /** Failures created after this ISO timestamp are left open. */
  startedAt: string;
}): Promise<void> {
  try {
    const repo = getSearchIndexFailureRepository();
    const open = await repo.listOpenForEntity(input.entityType, input.entityId);
    const now = new Date().toISOString();
    for (const failure of open) {
      if (failure.sourceRevision > input.sourceRevision) continue;
      if (failure.occurredAt > input.startedAt) continue;
      await repo.save({
        ...failure,
        resolvedAt: now,
        updatedAt: now,
      });
    }
  } catch {
    logger.warn("search.index.failure.resolve_failed", {
      entityType: input.entityType,
    });
  }
}

/**
 * Best-effort search index update after content transaction.
 * Never throws to the caller (publish must not roll back).
 */
export async function indexAfterArticlePublish(input: {
  ports: ContentPorts;
  articleId: string;
  versionId: string;
  requestId?: string;
}): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const article = await input.ports.articles.getById(input.articleId);
    if (!article || article.status !== "published" || !article.publishedVersion) {
      return;
    }
    const version = await input.ports.versions.getById(input.versionId);
    if (!version || version.entityType !== "article") {
      await recordFailure({
        entityType: "article",
        entityId: input.articleId,
        operation: "upsert",
        sourceRevision: article.revision as number,
        versionId: input.versionId,
        failureCode: "VERSION_MISSING",
        requestId: input.requestId,
      });
      return;
    }
    const snapshot = version.snapshot as ReturnType<typeof toArticleSnapshot>;
    const doc = buildArticleSearchDocument({
      live: article,
      snapshot,
      versionId: version.id as string,
      versionNumber: version.versionNumber as number,
    });
    // sourceRevision is the post-transaction aggregate revision.
    await getSearchIndex().applyMutation({ type: "upsert", document: doc });
    await resolveCoveredFailures({
      entityType: "article",
      entityId: input.articleId,
      sourceRevision: article.revision as number,
      startedAt,
    });
    logger.info("search.index.entity.reindexed", {
      entityType: "article",
      operation: "upsert",
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "details" in error
        ? String(
            (error as { details?: { adminCode?: string } }).details
              ?.adminCode ?? "UPSERT_FAILED",
          )
        : "UPSERT_FAILED";
    logger.warn("search.index.upsert.failed", { failureCode: code });
    const article = await input.ports.articles
      .getById(input.articleId)
      .catch(() => null);
    await recordFailure({
      entityType: "article",
      entityId: input.articleId,
      operation: "upsert",
      sourceRevision: (article?.revision as number) ?? 0,
      versionId: input.versionId,
      failureCode: code.slice(0, 64),
      requestId: input.requestId,
    });
  }
}

export async function indexAfterArticleRemoval(input: {
  ports: ContentPorts;
  articleId: string;
  requestId?: string;
}): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const article = await input.ports.articles.getById(input.articleId);
    if (!article) return;
    const tombstone = tombstoneForEntity({
      entityType: "article",
      entityId: input.articleId,
      sourceRevision: article.revision as number,
      versionId: article.publishedVersion,
    });
    await getSearchIndex().applyMutation({
      type: "remove",
      document: tombstone,
    });
    await resolveCoveredFailures({
      entityType: "article",
      entityId: input.articleId,
      sourceRevision: article.revision as number,
      startedAt,
    });
  } catch {
    const code = "REMOVE_FAILED";
    logger.warn("search.index.remove.failed", { failureCode: code });
    const article = await input.ports.articles
      .getById(input.articleId)
      .catch(() => null);
    await recordFailure({
      entityType: "article",
      entityId: input.articleId,
      operation: "remove",
      sourceRevision: (article?.revision as number) ?? 0,
      failureCode: code,
      requestId: input.requestId,
    });
  }
}

export async function indexAfterPromptPublish(input: {
  ports: ContentPorts;
  promptId: string;
  versionId: string;
  requestId?: string;
}): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const prompt = await input.ports.prompts.getById(input.promptId);
    if (!prompt || prompt.status !== "published" || !prompt.publishedVersion) {
      return;
    }
    const version = await input.ports.versions.getById(input.versionId);
    if (!version || version.entityType !== "prompt") {
      await recordFailure({
        entityType: "prompt",
        entityId: input.promptId,
        operation: "upsert",
        sourceRevision: prompt.revision as number,
        versionId: input.versionId,
        failureCode: "VERSION_MISSING",
        requestId: input.requestId,
      });
      return;
    }
    const snapshot = version.snapshot as ReturnType<typeof toPromptSnapshot>;
    const doc = buildPromptSearchDocument({
      live: prompt,
      snapshot,
      versionId: version.id as string,
      versionNumber: version.versionNumber as number,
    });
    await getSearchIndex().applyMutation({ type: "upsert", document: doc });
    await resolveCoveredFailures({
      entityType: "prompt",
      entityId: input.promptId,
      sourceRevision: prompt.revision as number,
      startedAt,
    });
  } catch {
    logger.warn("search.index.upsert.failed", { failureCode: "UPSERT_FAILED" });
    const prompt = await input.ports.prompts
      .getById(input.promptId)
      .catch(() => null);
    await recordFailure({
      entityType: "prompt",
      entityId: input.promptId,
      operation: "upsert",
      sourceRevision: (prompt?.revision as number) ?? 0,
      versionId: input.versionId,
      failureCode: "UPSERT_FAILED",
      requestId: input.requestId,
    });
  }
}

export async function indexAfterPromptRemoval(input: {
  ports: ContentPorts;
  promptId: string;
  requestId?: string;
}): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const prompt = await input.ports.prompts.getById(input.promptId);
    if (!prompt) return;
    const tombstone = tombstoneForEntity({
      entityType: "prompt",
      entityId: input.promptId,
      sourceRevision: prompt.revision as number,
      versionId: prompt.publishedVersion,
    });
    await getSearchIndex().applyMutation({
      type: "remove",
      document: tombstone,
    });
    await resolveCoveredFailures({
      entityType: "prompt",
      entityId: input.promptId,
      sourceRevision: prompt.revision as number,
      startedAt,
    });
  } catch {
    logger.warn("search.index.remove.failed", { failureCode: "REMOVE_FAILED" });
    const prompt = await input.ports.prompts
      .getById(input.promptId)
      .catch(() => null);
    await recordFailure({
      entityType: "prompt",
      entityId: input.promptId,
      operation: "remove",
      sourceRevision: (prompt?.revision as number) ?? 0,
      failureCode: "REMOVE_FAILED",
      requestId: input.requestId,
    });
  }
}

export type { ContentVersion };
