import { ValidationError } from "../shared/errors";
import type {
  ArticleId,
  AudienceId,
  CategoryId,
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
  parsePlainText,
  parseReviewDate,
  parseSlug,
  parseSummary,
  parseTitle,
  uniqueIds,
} from "../shared/value-objects";
import { portalSource, type SourceReference } from "./source";

export type Prompt = {
  id: PromptId;
  slug: Slug;
  title: Title;
  summary: Summary;
  categoryIds: CategoryId[];
  tagIds: TagId[];
  audienceIds: AudienceId[];
  promptText: string;
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  relatedArticleIds: ArticleId[];
  relatedVideoIds: VideoId[];
  status: ContentStatus;
  currentVersion: VersionId | null;
  publishedVersion: VersionId | null;
  ownerId: UserId | null;
  source: SourceReference;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  reviewDueAt: ReviewDate;
  revision: Revision;
};

export type CreatePromptInput = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  audienceIds?: string[];
  promptText: string;
  inputRequirements?: string | null;
  outputRequirements?: string | null;
  restrictions?: string | null;
  usageExample?: string | null;
  relatedArticleIds?: string[];
  relatedVideoIds?: string[];
  ownerId?: string | null;
  reviewDueAt?: string | null;
  source?: SourceReference;
  now: IsoDateTime;
};

function parseOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return parsePlainText(value, 5000);
}

export function createPrompt(input: CreatePromptInput): Prompt {
  const promptText = parsePlainText(
    input.promptText,
    CONTENT_LIMITS.promptText.max,
  );
  if (promptText.trim().length === 0) {
    throw new ValidationError("promptText is required");
  }

  return {
    id: PromptIdP.parse(input.id),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title),
    summary: parseSummary(input.summary ?? null),
    categoryIds: uniqueIds(
      (input.categoryIds ?? []).map((id) => CategoryIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.taxonomyIds),
    tagIds: uniqueIds(
      (input.tagIds ?? []).map((id) => TagIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.taxonomyIds),
    audienceIds: uniqueIds(
      (input.audienceIds ?? []).map((id) => AudienceIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.taxonomyIds),
    promptText,
    inputRequirements: parseOptionalText(input.inputRequirements),
    outputRequirements: parseOptionalText(input.outputRequirements),
    restrictions: parseOptionalText(input.restrictions),
    usageExample: parseOptionalText(input.usageExample),
    relatedArticleIds: uniqueIds(
      (input.relatedArticleIds ?? []).map((id) => ArticleIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.relatedIds),
    relatedVideoIds: uniqueIds(
      (input.relatedVideoIds ?? []).map((id) => VideoIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.relatedIds),
    status: "draft",
    currentVersion: null,
    publishedVersion: null,
    ownerId: input.ownerId ? UserIdP.parse(input.ownerId) : null,
    source: input.source ?? portalSource(),
    createdAt: input.now,
    updatedAt: input.now,
    publishedAt: null,
    reviewDueAt: parseReviewDate(input.reviewDueAt ?? null),
    revision: initialRevision(),
  };
}

export function assertPromptPublishable(prompt: Prompt): void {
  if (!prompt.title || !prompt.slug) {
    throw new ValidationError("Cannot publish prompt without title and slug");
  }
  if (!prompt.promptText.trim()) {
    throw new ValidationError("Cannot publish empty promptText");
  }
  if (!prompt.ownerId) {
    throw new ValidationError("Published prompt requires ownerId");
  }
}

export function withPromptUpdate(
  prompt: Prompt,
  patch: Partial<{
    title: string;
    slug: string;
    summary: string | null;
    categoryIds: string[];
    tagIds: string[];
    audienceIds: string[];
    promptText: string;
    inputRequirements: string | null;
    outputRequirements: string | null;
    restrictions: string | null;
    usageExample: string | null;
    relatedArticleIds: string[];
    relatedVideoIds: string[];
    ownerId: string | null;
    reviewDueAt: string | null;
    source: SourceReference;
  }>,
  now: IsoDateTime,
): Prompt {
  const nextText =
    patch.promptText !== undefined
      ? parsePlainText(patch.promptText, CONTENT_LIMITS.promptText.max)
      : prompt.promptText;
  if (!nextText.trim()) {
    throw new ValidationError("promptText is required");
  }

  return {
    ...prompt,
    title: patch.title !== undefined ? parseTitle(patch.title) : prompt.title,
    slug: patch.slug !== undefined ? parseSlug(patch.slug) : prompt.slug,
    summary:
      patch.summary !== undefined
        ? parseSummary(patch.summary)
        : prompt.summary,
    categoryIds:
      patch.categoryIds !== undefined
        ? uniqueIds(patch.categoryIds.map((id) => CategoryIdP.parse(id))).slice(
            0,
            CONTENT_LIMITS.taxonomyIds,
          )
        : prompt.categoryIds,
    tagIds:
      patch.tagIds !== undefined
        ? uniqueIds(patch.tagIds.map((id) => TagIdP.parse(id))).slice(
            0,
            CONTENT_LIMITS.taxonomyIds,
          )
        : prompt.tagIds,
    audienceIds:
      patch.audienceIds !== undefined
        ? uniqueIds(
            patch.audienceIds.map((id) => AudienceIdP.parse(id)),
          ).slice(0, CONTENT_LIMITS.taxonomyIds)
        : prompt.audienceIds,
    promptText: nextText,
    inputRequirements:
      patch.inputRequirements !== undefined
        ? parseOptionalText(patch.inputRequirements)
        : prompt.inputRequirements,
    outputRequirements:
      patch.outputRequirements !== undefined
        ? parseOptionalText(patch.outputRequirements)
        : prompt.outputRequirements,
    restrictions:
      patch.restrictions !== undefined
        ? parseOptionalText(patch.restrictions)
        : prompt.restrictions,
    usageExample:
      patch.usageExample !== undefined
        ? parseOptionalText(patch.usageExample)
        : prompt.usageExample,
    relatedArticleIds:
      patch.relatedArticleIds !== undefined
        ? uniqueIds(
            patch.relatedArticleIds.map((id) => ArticleIdP.parse(id)),
          ).slice(0, CONTENT_LIMITS.relatedIds)
        : prompt.relatedArticleIds,
    relatedVideoIds:
      patch.relatedVideoIds !== undefined
        ? uniqueIds(
            patch.relatedVideoIds.map((id) => VideoIdP.parse(id)),
          ).slice(0, CONTENT_LIMITS.relatedIds)
        : prompt.relatedVideoIds,
    ownerId:
      patch.ownerId !== undefined
        ? patch.ownerId
          ? UserIdP.parse(patch.ownerId)
          : null
        : prompt.ownerId,
    reviewDueAt:
      patch.reviewDueAt !== undefined
        ? parseReviewDate(patch.reviewDueAt)
        : prompt.reviewDueAt,
    source: patch.source !== undefined ? patch.source : prompt.source,
    updatedAt: now,
    revision: nextRevision(prompt.revision),
  };
}

export function markPromptPublished(
  prompt: Prompt,
  versionId: VersionId,
  now: IsoDateTime,
): Prompt {
  assertPromptPublishable(prompt);
  return {
    ...prompt,
    status: "published",
    publishedVersion: versionId,
    currentVersion: versionId,
    publishedAt: now,
    updatedAt: now,
    source: portalSource(),
    revision: nextRevision(prompt.revision),
  };
}

export function markPromptHidden(prompt: Prompt, now: IsoDateTime): Prompt {
  return {
    ...prompt,
    status: "hidden",
    updatedAt: now,
    revision: nextRevision(prompt.revision),
  };
}

export function markPromptArchived(prompt: Prompt, now: IsoDateTime): Prompt {
  return {
    ...prompt,
    status: "archived",
    updatedAt: now,
    revision: nextRevision(prompt.revision),
  };
}

export type PromptSnapshot = {
  slug: string;
  title: string;
  summary: string | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  promptText: string;
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  relatedArticleIds: string[];
  relatedVideoIds: string[];
  ownerId: string | null;
  reviewDueAt: string | null;
};

export function toPromptSnapshot(prompt: Prompt): PromptSnapshot {
  return {
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    categoryIds: [...prompt.categoryIds],
    tagIds: [...prompt.tagIds],
    audienceIds: [...prompt.audienceIds],
    promptText: prompt.promptText,
    inputRequirements: prompt.inputRequirements,
    outputRequirements: prompt.outputRequirements,
    restrictions: prompt.restrictions,
    usageExample: prompt.usageExample,
    relatedArticleIds: [...prompt.relatedArticleIds],
    relatedVideoIds: [...prompt.relatedVideoIds],
    ownerId: prompt.ownerId,
    reviewDueAt: prompt.reviewDueAt,
  };
}

export function applyPromptVersionSnapshot(
  prompt: Prompt,
  snapshot: PromptSnapshot,
  now: IsoDateTime,
): Prompt {
  const restored = createPrompt({
    id: prompt.id,
    ...snapshot,
    now,
  });
  return {
    ...restored,
    status: "draft",
    currentVersion: prompt.currentVersion,
    publishedVersion: prompt.publishedVersion,
    publishedAt: null,
    createdAt: prompt.createdAt,
    revision: nextRevision(prompt.revision),
  };
}

/**
 * Materialize the publicly visible Prompt view from the last published snapshot.
 * Working-copy taxonomy/fields must not leak to public until republish.
 */
export function promptFromPublishedSnapshot(
  live: Prompt,
  snapshot: PromptSnapshot,
): Prompt {
  if (live.status !== "published" || !live.publishedVersion) {
    throw new ValidationError(
      "Published snapshot requires a published prompt with publishedVersion",
    );
  }
  const material = createPrompt({
    id: live.id,
    slug: snapshot.slug,
    title: snapshot.title,
    summary: snapshot.summary,
    categoryIds: snapshot.categoryIds,
    tagIds: snapshot.tagIds,
    audienceIds: snapshot.audienceIds,
    promptText: snapshot.promptText,
    inputRequirements: snapshot.inputRequirements,
    outputRequirements: snapshot.outputRequirements,
    restrictions: snapshot.restrictions,
    usageExample: snapshot.usageExample,
    relatedArticleIds: snapshot.relatedArticleIds,
    relatedVideoIds: snapshot.relatedVideoIds,
    ownerId: snapshot.ownerId,
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
