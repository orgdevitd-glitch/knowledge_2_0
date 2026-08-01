import "server-only";

import type { Article } from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import type { ContentStatus } from "@/domain/shared/status";

/** Safe admin article DTO for API / editor (no secrets). */
export type AdminArticleDto = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: ContentStatus;
  revision: number;
  blockCount: number;
  blocks: ContentBlock[];
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  relatedArticleIds: string[];
  relatedPromptIds: string[];
  relatedVideoIds: string[];
  ownerId: string | null;
  authorId: string | null;
  currentVersion: string | null;
  publishedVersion: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  reviewDueAt: string | null;
  sourceKind: string;
};

export function toAdminArticleDto(article: Article): AdminArticleDto {
  return {
    id: article.id as string,
    slug: article.slug as string,
    title: article.title as string,
    summary: (article.summary as string | null) ?? null,
    status: article.status,
    revision: article.revision as number,
    blockCount: article.blocks.length,
    blocks: structuredClone(article.blocks),
    categoryIds: article.categoryIds.map(String),
    tagIds: article.tagIds.map(String),
    audienceIds: article.audienceIds.map(String),
    relatedArticleIds: article.relatedArticleIds.map(String),
    relatedPromptIds: article.relatedPromptIds.map(String),
    relatedVideoIds: article.relatedVideoIds.map(String),
    ownerId: article.ownerId ? String(article.ownerId) : null,
    authorId: article.authorId ? String(article.authorId) : null,
    currentVersion: article.currentVersion
      ? String(article.currentVersion)
      : null,
    publishedVersion: article.publishedVersion
      ? String(article.publishedVersion)
      : null,
    createdAt: article.createdAt as string,
    updatedAt: article.updatedAt as string,
    publishedAt: (article.publishedAt as string | null) ?? null,
    reviewDueAt: (article.reviewDueAt as string | null) ?? null,
    sourceKind: article.source.type,
  };
}
