import "server-only";

import type {
  ContentPorts,
  UseCaseContext,
} from "@/features/content/application/ports";
import {
  archiveArticle,
  hideArticle,
  publishArticle,
} from "@/features/content/application/article-use-cases";
import {
  archivePrompt,
  hidePrompt,
  publishPrompt,
} from "@/features/content/application/prompt-use-cases";
import {
  indexAfterArticlePublish,
  indexAfterArticleRemoval,
  indexAfterPromptPublish,
  indexAfterPromptRemoval,
} from "@/features/search/application/indexing-service";
import { getPublicContentInvalidation } from "@/server/content/public-invalidation";

/**
 * Application orchestration: content mutation → best-effort search indexing.
 * HTTP routes must call these helpers (not duplicate index lifecycle).
 */

export async function publishArticleAndIndex(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
  changeSummary?: string | null,
) {
  const result = await publishArticle(
    ports,
    ctx,
    articleId,
    expectedRevision,
    changeSummary ?? undefined,
  );
  getPublicContentInvalidation().invalidateArticle({
    slug: result.article.slug as string,
  });
  await indexAfterArticlePublish({
    ports,
    articleId,
    versionId: result.versionId,
    // sourceRevision comes from saved aggregate inside indexing (post-txn).
    requestId: ctx.requestId,
  });
  return result;
}

export async function hideArticleAndIndex(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
) {
  const article = await hideArticle(ports, ctx, articleId, expectedRevision);
  getPublicContentInvalidation().invalidateArticle({
    slug: article.slug as string,
  });
  await indexAfterArticleRemoval({
    ports,
    articleId,
    requestId: ctx.requestId,
  });
  return article;
}

export async function archiveArticleAndIndex(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
) {
  const article = await archiveArticle(ports, ctx, articleId, expectedRevision);
  getPublicContentInvalidation().invalidateArticle({
    slug: article.slug as string,
  });
  await indexAfterArticleRemoval({
    ports,
    articleId,
    requestId: ctx.requestId,
  });
  return article;
}

export async function publishPromptAndIndex(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
  changeSummary?: string | null,
) {
  const result = await publishPrompt(
    ports,
    ctx,
    promptId,
    expectedRevision,
    changeSummary ?? undefined,
  );
  getPublicContentInvalidation().invalidatePrompt({
    slug: result.prompt.slug as string,
  });
  await indexAfterPromptPublish({
    ports,
    promptId,
    versionId: result.versionId,
    requestId: ctx.requestId,
  });
  return result;
}

export async function hidePromptAndIndex(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
) {
  const prompt = await hidePrompt(ports, ctx, promptId, expectedRevision);
  getPublicContentInvalidation().invalidatePrompt({
    slug: prompt.slug as string,
  });
  await indexAfterPromptRemoval({
    ports,
    promptId,
    requestId: ctx.requestId,
  });
  return prompt;
}

export async function archivePromptAndIndex(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
) {
  const prompt = await archivePrompt(ports, ctx, promptId, expectedRevision);
  getPublicContentInvalidation().invalidatePrompt({
    slug: prompt.slug as string,
  });
  await indexAfterPromptRemoval({
    ports,
    promptId,
    requestId: ctx.requestId,
  });
  return prompt;
}
