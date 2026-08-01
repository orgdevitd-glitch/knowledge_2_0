import { ValidationError } from "../shared/errors";
import type {
  ArticleId,
  AudienceId,
  CategoryId,
  MediaId,
  PromptId,
  TagId,
  UserId,
  VersionId,
  VideoId,
} from "../shared/ids";
import {
  ArticleId as ArticleIdP,
  AudienceId as AudienceIdP,
  CategoryId as CategoryIdP,
  MediaId as MediaIdP,
  PromptId as PromptIdP,
  TagId as TagIdP,
  UserId as UserIdP,
  VideoId as VideoIdP,
} from "../shared/ids";
import { CONTENT_LIMITS } from "../shared/limits";
import type { ContentStatus } from "../shared/status";
import type {
  IsoDateTime,
  Revision,
  ReviewDate,
  Slug,
  Summary,
  Title,
} from "../shared/value-objects";
import {
  initialRevision,
  nextRevision,
  parseReviewDate,
  parseSlug,
  parseSummary,
  parseTitle,
  uniqueIds,
} from "../shared/value-objects";
import type { ContentBlock } from "./blocks";
import { reorderBlocks, validateBlocks } from "./blocks";
import type { SourceReference } from "./source";
import { portalSource } from "./source";

export type Article = {
  id: ArticleId;
  slug: Slug;
  title: Title;
  summary: Summary;
  coverMediaId: MediaId | null;
  categoryIds: CategoryId[];
  tagIds: TagId[];
  audienceIds: AudienceId[];
  ownerId: UserId | null;
  authorId: UserId | null;
  status: ContentStatus;
  /** Block order is array order (stable BlockId per block). */
  blocks: ContentBlock[];
  relatedArticleIds: ArticleId[];
  relatedPromptIds: PromptId[];
  relatedVideoIds: VideoId[];
  source: SourceReference;
  currentVersion: VersionId | null;
  publishedVersion: VersionId | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  reviewDueAt: ReviewDate;
  revision: Revision;
};

export type CreateArticleInput = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverMediaId?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  audienceIds?: string[];
  ownerId?: string | null;
  authorId?: string | null;
  blocks?: unknown[];
  relatedArticleIds?: string[];
  relatedPromptIds?: string[];
  relatedVideoIds?: string[];
  source?: SourceReference;
  reviewDueAt?: string | null;
  now: IsoDateTime;
};

function parseRelatedArticles(
  ids: string[] | undefined,
  selfId: ArticleId,
): ArticleId[] {
  const list = uniqueIds((ids ?? []).map((id) => ArticleIdP.parse(id)));
  if (list.some((id) => id === selfId)) {
    throw new ValidationError("Article cannot reference itself");
  }
  if (list.length > CONTENT_LIMITS.relatedIds) {
    throw new ValidationError("Too many related article ids");
  }
  return list;
}

function parseTaxonomyIds<T extends string>(
  ids: string[] | undefined,
  parse: (v: unknown) => T,
  label: string,
): T[] {
  const list = uniqueIds((ids ?? []).map((id) => parse(id)));
  if (list.length > CONTENT_LIMITS.taxonomyIds) {
    throw new ValidationError(`Too many ${label}`);
  }
  return list;
}

export function createArticle(input: CreateArticleInput): Article {
  const id = ArticleIdP.parse(input.id);
  const title = parseTitle(input.title);
  const slug = parseSlug(input.slug);
  const now = input.now;
  const blocks = validateBlocks(input.blocks ?? []);

  return {
    id,
    slug,
    title,
    summary: parseSummary(input.summary ?? null),
    coverMediaId: input.coverMediaId
      ? MediaIdP.parse(input.coverMediaId)
      : null,
    categoryIds: parseTaxonomyIds(
      input.categoryIds,
      CategoryIdP.parse,
      "categoryIds",
    ),
    tagIds: parseTaxonomyIds(input.tagIds, TagIdP.parse, "tagIds"),
    audienceIds: parseTaxonomyIds(
      input.audienceIds,
      AudienceIdP.parse,
      "audienceIds",
    ),
    ownerId: input.ownerId ? UserIdP.parse(input.ownerId) : null,
    authorId: input.authorId ? UserIdP.parse(input.authorId) : null,
    status: "draft",
    blocks,
    relatedArticleIds: parseRelatedArticles(input.relatedArticleIds, id),
    relatedPromptIds: uniqueIds(
      (input.relatedPromptIds ?? []).map((x) => PromptIdP.parse(x)),
    ).slice(0, CONTENT_LIMITS.relatedIds),
    relatedVideoIds: uniqueIds(
      (input.relatedVideoIds ?? []).map((x) => VideoIdP.parse(x)),
    ).slice(0, CONTENT_LIMITS.relatedIds),
    source: input.source ?? portalSource(),
    currentVersion: null,
    publishedVersion: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    reviewDueAt: parseReviewDate(input.reviewDueAt ?? null),
    revision: initialRevision(),
  };
}

export function assertArticlePublishable(article: Article): void {
  if (!article.title || String(article.title).trim().length === 0) {
    throw new ValidationError("Cannot publish article without title");
  }
  if (!article.slug) {
    throw new ValidationError("Cannot publish article without slug");
  }
  if (article.blocks.length === 0) {
    throw new ValidationError("Cannot publish article without blocks");
  }
  if (!article.ownerId) {
    throw new ValidationError("Published article requires ownerId");
  }
  validateBlocks(article.blocks);
}

export function withArticleMetadata(
  article: Article,
  patch: {
    title?: string;
    slug?: string;
    summary?: string | null;
    coverMediaId?: string | null;
    categoryIds?: string[];
    tagIds?: string[];
    audienceIds?: string[];
    ownerId?: string | null;
    authorId?: string | null;
    relatedArticleIds?: string[];
    relatedPromptIds?: string[];
    relatedVideoIds?: string[];
    reviewDueAt?: string | null;
    source?: SourceReference;
  },
  now: IsoDateTime,
): Article {
  return {
    ...article,
    title: patch.title !== undefined ? parseTitle(patch.title) : article.title,
    slug: patch.slug !== undefined ? parseSlug(patch.slug) : article.slug,
    summary:
      patch.summary !== undefined
        ? parseSummary(patch.summary)
        : article.summary,
    coverMediaId:
      patch.coverMediaId !== undefined
        ? patch.coverMediaId
          ? MediaIdP.parse(patch.coverMediaId)
          : null
        : article.coverMediaId,
    categoryIds:
      patch.categoryIds !== undefined
        ? parseTaxonomyIds(
            patch.categoryIds,
            CategoryIdP.parse,
            "categoryIds",
          )
        : article.categoryIds,
    tagIds:
      patch.tagIds !== undefined
        ? parseTaxonomyIds(patch.tagIds, TagIdP.parse, "tagIds")
        : article.tagIds,
    audienceIds:
      patch.audienceIds !== undefined
        ? parseTaxonomyIds(
            patch.audienceIds,
            AudienceIdP.parse,
            "audienceIds",
          )
        : article.audienceIds,
    ownerId:
      patch.ownerId !== undefined
        ? patch.ownerId
          ? UserIdP.parse(patch.ownerId)
          : null
        : article.ownerId,
    authorId:
      patch.authorId !== undefined
        ? patch.authorId
          ? UserIdP.parse(patch.authorId)
          : null
        : article.authorId,
    relatedArticleIds:
      patch.relatedArticleIds !== undefined
        ? parseRelatedArticles(patch.relatedArticleIds, article.id)
        : article.relatedArticleIds,
    relatedPromptIds:
      patch.relatedPromptIds !== undefined
        ? uniqueIds(
            patch.relatedPromptIds.map((x) => PromptIdP.parse(x)),
          ).slice(0, CONTENT_LIMITS.relatedIds)
        : article.relatedPromptIds,
    relatedVideoIds:
      patch.relatedVideoIds !== undefined
        ? uniqueIds(patch.relatedVideoIds.map((x) => VideoIdP.parse(x))).slice(
            0,
            CONTENT_LIMITS.relatedIds,
          )
        : article.relatedVideoIds,
    reviewDueAt:
      patch.reviewDueAt !== undefined
        ? parseReviewDate(patch.reviewDueAt)
        : article.reviewDueAt,
    source: patch.source ?? article.source,
    updatedAt: now,
    revision: nextRevision(article.revision),
  };
}

export function withArticleBlocks(
  article: Article,
  blocks: unknown[],
  now: IsoDateTime,
): Article {
  return {
    ...article,
    blocks: validateBlocks(blocks),
    updatedAt: now,
    revision: nextRevision(article.revision),
  };
}

export function withReorderedBlocks(
  article: Article,
  orderedIds: string[],
  now: IsoDateTime,
): Article {
  return {
    ...article,
    blocks: reorderBlocks(article.blocks, orderedIds),
    updatedAt: now,
    revision: nextRevision(article.revision),
  };
}

export function markArticlePublished(
  article: Article,
  versionId: VersionId,
  now: IsoDateTime,
): Article {
  assertArticlePublishable(article);
  return {
    ...article,
    status: "published",
    publishedVersion: versionId,
    currentVersion: versionId,
    publishedAt: now,
    updatedAt: now,
    source: portalSource(),
    revision: nextRevision(article.revision),
  };
}

export function markArticleHidden(article: Article, now: IsoDateTime): Article {
  return {
    ...article,
    status: "hidden",
    updatedAt: now,
    revision: nextRevision(article.revision),
  };
}

export function markArticleArchived(
  article: Article,
  now: IsoDateTime,
): Article {
  return {
    ...article,
    status: "archived",
    updatedAt: now,
    revision: nextRevision(article.revision),
  };
}

export function markArticleRestoredFromArchive(
  article: Article,
  now: IsoDateTime,
): Article {
  return {
    ...article,
    status: "draft",
    publishedAt: null,
    updatedAt: now,
    revision: nextRevision(article.revision),
  };
}

export function applyArticleVersionSnapshot(
  article: Article,
  snapshot: ArticleSnapshot,
  now: IsoDateTime,
): Article {
  const restored = createArticle({
    id: article.id,
    slug: snapshot.slug,
    title: snapshot.title,
    summary: snapshot.summary,
    coverMediaId: snapshot.coverMediaId,
    categoryIds: snapshot.categoryIds,
    tagIds: snapshot.tagIds,
    audienceIds: snapshot.audienceIds,
    ownerId: snapshot.ownerId,
    authorId: snapshot.authorId,
    blocks: snapshot.blocks,
    relatedArticleIds: snapshot.relatedArticleIds,
    relatedPromptIds: snapshot.relatedPromptIds,
    relatedVideoIds: snapshot.relatedVideoIds,
    source: snapshot.source,
    reviewDueAt: snapshot.reviewDueAt,
    now,
  });
  return {
    ...restored,
    status: "draft",
    currentVersion: article.currentVersion,
    publishedVersion: article.publishedVersion,
    publishedAt: null,
    createdAt: article.createdAt,
    revision: nextRevision(article.revision),
  };
}

export type ArticleSnapshot = {
  slug: string;
  title: string;
  summary: string | null;
  coverMediaId: string | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  ownerId: string | null;
  authorId: string | null;
  blocks: ContentBlock[];
  relatedArticleIds: string[];
  relatedPromptIds: string[];
  relatedVideoIds: string[];
  source: SourceReference;
  reviewDueAt: string | null;
};

export function toArticleSnapshot(article: Article): ArticleSnapshot {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    coverMediaId: article.coverMediaId,
    categoryIds: [...article.categoryIds],
    tagIds: [...article.tagIds],
    audienceIds: [...article.audienceIds],
    ownerId: article.ownerId,
    authorId: article.authorId,
    blocks: article.blocks.map((b) => structuredClone(b)),
    relatedArticleIds: [...article.relatedArticleIds],
    relatedPromptIds: [...article.relatedPromptIds],
    relatedVideoIds: [...article.relatedVideoIds],
    source: structuredClone(article.source),
    reviewDueAt: article.reviewDueAt,
  };
}

/**
 * Materialize the publicly visible Article view from the last published snapshot.
 * Working-copy fields on the live entity must not leak to public until republish.
 */
export function articleFromPublishedSnapshot(
  live: Article,
  snapshot: ArticleSnapshot,
): Article {
  if (live.status !== "published" || !live.publishedVersion) {
    throw new ValidationError(
      "Published snapshot requires a published article with publishedVersion",
    );
  }
  const material = createArticle({
    id: live.id,
    slug: snapshot.slug,
    title: snapshot.title,
    summary: snapshot.summary,
    coverMediaId: snapshot.coverMediaId,
    categoryIds: snapshot.categoryIds,
    tagIds: snapshot.tagIds,
    audienceIds: snapshot.audienceIds,
    ownerId: snapshot.ownerId,
    authorId: snapshot.authorId,
    blocks: snapshot.blocks,
    relatedArticleIds: snapshot.relatedArticleIds,
    relatedPromptIds: snapshot.relatedPromptIds,
    relatedVideoIds: snapshot.relatedVideoIds,
    source: snapshot.source,
    reviewDueAt: snapshot.reviewDueAt,
    now: live.updatedAt,
  });
  return {
    ...material,
    status: "published",
    currentVersion: live.currentVersion,
    publishedVersion: live.publishedVersion,
    publishedAt: live.publishedAt,
    createdAt: live.createdAt,
    updatedAt: live.updatedAt,
    revision: live.revision,
  };
}
