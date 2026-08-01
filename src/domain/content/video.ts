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
import { parseSafeUrl, type SafeUrl } from "../shared/url";
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
import { portalSource, type SourceReference } from "./source";

export type VideoChapter = {
  title: string;
  startSeconds: number;
};

export type VideoTranscript =
  | { kind: "media"; mediaId: MediaId }
  | { kind: "text"; text: string };

export type Video = {
  id: VideoId;
  slug: Slug;
  title: Title;
  summary: Summary;
  source: SourceReference;
  mediaId: MediaId | null;
  externalUrl: SafeUrl | null;
  posterMediaId: MediaId | null;
  durationSeconds: number | null;
  chapters: VideoChapter[];
  transcript: VideoTranscript | null;
  categoryIds: CategoryId[];
  tagIds: TagId[];
  audienceIds: AudienceId[];
  relatedArticleIds: ArticleId[];
  relatedPromptIds: PromptId[];
  status: ContentStatus;
  currentVersion: VersionId | null;
  publishedVersion: VersionId | null;
  ownerId: UserId | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  reviewDueAt: ReviewDate;
  revision: Revision;
};

export type CreateVideoInput = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  source?: SourceReference;
  mediaId?: string | null;
  externalUrl?: string | null;
  posterMediaId?: string | null;
  durationSeconds?: number | null;
  chapters?: VideoChapter[];
  transcript?: VideoTranscript | null;
  categoryIds?: string[];
  tagIds?: string[];
  audienceIds?: string[];
  relatedArticleIds?: string[];
  relatedPromptIds?: string[];
  ownerId?: string | null;
  reviewDueAt?: string | null;
  now: IsoDateTime;
};

function parseChapters(
  chapters: VideoChapter[] | undefined,
  durationSeconds: number | null,
): VideoChapter[] {
  const list = chapters ?? [];
  if (list.length > CONTENT_LIMITS.videoChapters) {
    throw new ValidationError("Too many video chapters");
  }
  for (const ch of list) {
    if (!ch.title.trim()) {
      throw new ValidationError("Chapter title is required");
    }
    if (ch.startSeconds < 0) {
      throw new ValidationError("Chapter startSeconds cannot be negative");
    }
    if (durationSeconds !== null && ch.startSeconds > durationSeconds) {
      throw new ValidationError(
        "Chapter startSeconds cannot exceed duration",
        { startSeconds: ch.startSeconds, durationSeconds },
      );
    }
  }
  for (let i = 1; i < list.length; i += 1) {
    const current = list[i];
    const previous = list[i - 1];
    if (!current || !previous) continue;
    if (current.startSeconds < previous.startSeconds) {
      throw new ValidationError(
        "Chapters must be sorted by startSeconds ascending",
      );
    }
  }
  return list.map((c) => ({
    title: c.title.trim(),
    startSeconds: c.startSeconds,
  }));
}

function parsePrimarySource(
  mediaId: string | null | undefined,
  externalUrl: string | null | undefined,
): { mediaId: MediaId | null; externalUrl: SafeUrl | null } {
  const hasMedia = Boolean(mediaId);
  const hasExternal = Boolean(externalUrl);
  if (hasMedia && hasExternal) {
    throw new ValidationError(
      "Video must have exactly one primary source: mediaId or externalUrl",
    );
  }
  return {
    mediaId: mediaId ? MediaIdP.parse(mediaId) : null,
    externalUrl: externalUrl
      ? parseSafeUrl(externalUrl, {
          requireHttpsAbsolute: true,
          allowRelative: false,
        })
      : null,
  };
}

export function createVideo(input: CreateVideoInput): Video {
  const duration =
    input.durationSeconds === undefined || input.durationSeconds === null
      ? null
      : input.durationSeconds;
  if (duration !== null && duration < 0) {
    throw new ValidationError("durationSeconds cannot be negative");
  }

  const primary = parsePrimarySource(input.mediaId, input.externalUrl);

  return {
    id: VideoIdP.parse(input.id),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title),
    summary: parseSummary(input.summary ?? null),
    source: input.source ?? portalSource(),
    mediaId: primary.mediaId,
    externalUrl: primary.externalUrl,
    posterMediaId: input.posterMediaId
      ? MediaIdP.parse(input.posterMediaId)
      : null,
    durationSeconds: duration,
    chapters: parseChapters(input.chapters, duration),
    transcript: input.transcript
      ? input.transcript.kind === "media"
        ? {
            kind: "media",
            mediaId: MediaIdP.parse(input.transcript.mediaId),
          }
        : {
            kind: "text",
            text: input.transcript.text.slice(0, CONTENT_LIMITS.plainText.max),
          }
      : null,
    categoryIds: uniqueIds(
      (input.categoryIds ?? []).map((id) => CategoryIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.taxonomyIds),
    tagIds: uniqueIds(
      (input.tagIds ?? []).map((id) => TagIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.taxonomyIds),
    audienceIds: uniqueIds(
      (input.audienceIds ?? []).map((id) => AudienceIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.taxonomyIds),
    relatedArticleIds: uniqueIds(
      (input.relatedArticleIds ?? []).map((id) => ArticleIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.relatedIds),
    relatedPromptIds: uniqueIds(
      (input.relatedPromptIds ?? []).map((id) => PromptIdP.parse(id)),
    ).slice(0, CONTENT_LIMITS.relatedIds),
    status: "draft",
    currentVersion: null,
    publishedVersion: null,
    ownerId: input.ownerId ? UserIdP.parse(input.ownerId) : null,
    createdAt: input.now,
    updatedAt: input.now,
    publishedAt: null,
    reviewDueAt: parseReviewDate(input.reviewDueAt ?? null),
    revision: initialRevision(),
  };
}

export function assertVideoPublishable(video: Video): void {
  if (!video.title || !video.slug) {
    throw new ValidationError("Cannot publish video without title and slug");
  }
  if (!video.ownerId) {
    throw new ValidationError("Published video requires ownerId");
  }
  if (!video.mediaId && !video.externalUrl) {
    throw new ValidationError("Published video requires a primary source");
  }
  if (video.mediaId && video.externalUrl) {
    throw new ValidationError("Video cannot have two primary sources");
  }
}

export function withVideoUpdate(
  video: Video,
  patch: Partial<{
    title: string;
    slug: string;
    summary: string | null;
    mediaId: string | null;
    externalUrl: string | null;
    posterMediaId: string | null;
    durationSeconds: number | null;
    chapters: VideoChapter[];
    transcript: VideoTranscript | null;
    categoryIds: string[];
    tagIds: string[];
    audienceIds: string[];
    relatedArticleIds: string[];
    relatedPromptIds: string[];
    ownerId: string | null;
    reviewDueAt: string | null;
    source: SourceReference;
  }>,
  now: IsoDateTime,
): Video {
  const duration =
    patch.durationSeconds !== undefined
      ? patch.durationSeconds
      : video.durationSeconds;
  if (duration !== null && duration !== undefined && duration < 0) {
    throw new ValidationError("durationSeconds cannot be negative");
  }

  const mediaId =
    patch.mediaId !== undefined
      ? patch.mediaId
      : video.mediaId;
  const externalUrl =
    patch.externalUrl !== undefined
      ? patch.externalUrl
      : video.externalUrl;

  const primary = parsePrimarySource(
    mediaId as string | null,
    externalUrl as string | null,
  );

  return {
    ...video,
    title: patch.title !== undefined ? parseTitle(patch.title) : video.title,
    slug: patch.slug !== undefined ? parseSlug(patch.slug) : video.slug,
    summary:
      patch.summary !== undefined ? parseSummary(patch.summary) : video.summary,
    mediaId: primary.mediaId,
    externalUrl: primary.externalUrl,
    posterMediaId:
      patch.posterMediaId !== undefined
        ? patch.posterMediaId
          ? MediaIdP.parse(patch.posterMediaId)
          : null
        : video.posterMediaId,
    durationSeconds: duration ?? null,
    chapters:
      patch.chapters !== undefined
        ? parseChapters(patch.chapters, duration ?? null)
        : parseChapters(video.chapters, duration ?? null),
    transcript:
      patch.transcript !== undefined
        ? patch.transcript
          ? patch.transcript.kind === "media"
            ? {
                kind: "media" as const,
                mediaId: MediaIdP.parse(patch.transcript.mediaId),
              }
            : {
                kind: "text" as const,
                text: patch.transcript.text.slice(
                  0,
                  CONTENT_LIMITS.plainText.max,
                ),
              }
          : null
        : video.transcript,
    categoryIds:
      patch.categoryIds !== undefined
        ? uniqueIds(patch.categoryIds.map((id) => CategoryIdP.parse(id))).slice(
            0,
            CONTENT_LIMITS.taxonomyIds,
          )
        : video.categoryIds,
    tagIds:
      patch.tagIds !== undefined
        ? uniqueIds(patch.tagIds.map((id) => TagIdP.parse(id))).slice(
            0,
            CONTENT_LIMITS.taxonomyIds,
          )
        : video.tagIds,
    audienceIds:
      patch.audienceIds !== undefined
        ? uniqueIds(
            patch.audienceIds.map((id) => AudienceIdP.parse(id)),
          ).slice(0, CONTENT_LIMITS.taxonomyIds)
        : video.audienceIds,
    relatedArticleIds:
      patch.relatedArticleIds !== undefined
        ? uniqueIds(
            patch.relatedArticleIds.map((id) => ArticleIdP.parse(id)),
          ).slice(0, CONTENT_LIMITS.relatedIds)
        : video.relatedArticleIds,
    relatedPromptIds:
      patch.relatedPromptIds !== undefined
        ? uniqueIds(
            patch.relatedPromptIds.map((id) => PromptIdP.parse(id)),
          ).slice(0, CONTENT_LIMITS.relatedIds)
        : video.relatedPromptIds,
    ownerId:
      patch.ownerId !== undefined
        ? patch.ownerId
          ? UserIdP.parse(patch.ownerId)
          : null
        : video.ownerId,
    reviewDueAt:
      patch.reviewDueAt !== undefined
        ? parseReviewDate(patch.reviewDueAt)
        : video.reviewDueAt,
    source: patch.source ?? video.source,
    updatedAt: now,
    revision: nextRevision(video.revision),
  };
}

export function markVideoPublished(
  video: Video,
  versionId: VersionId,
  now: IsoDateTime,
): Video {
  assertVideoPublishable(video);
  return {
    ...video,
    status: "published",
    publishedVersion: versionId,
    currentVersion: versionId,
    publishedAt: now,
    updatedAt: now,
    source: portalSource(),
    revision: nextRevision(video.revision),
  };
}

export function markVideoHidden(video: Video, now: IsoDateTime): Video {
  return {
    ...video,
    status: "hidden",
    updatedAt: now,
    revision: nextRevision(video.revision),
  };
}

export function markVideoArchived(video: Video, now: IsoDateTime): Video {
  return {
    ...video,
    status: "archived",
    updatedAt: now,
    revision: nextRevision(video.revision),
  };
}

export type VideoSnapshot = {
  slug: string;
  title: string;
  summary: string | null;
  mediaId: string | null;
  externalUrl: string | null;
  posterMediaId: string | null;
  durationSeconds: number | null;
  chapters: VideoChapter[];
  transcript: VideoTranscript | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  relatedArticleIds: string[];
  relatedPromptIds: string[];
  ownerId: string | null;
  reviewDueAt: string | null;
  source: SourceReference;
};

export function toVideoSnapshot(video: Video): VideoSnapshot {
  return {
    slug: video.slug,
    title: video.title,
    summary: video.summary,
    mediaId: video.mediaId,
    externalUrl: video.externalUrl,
    posterMediaId: video.posterMediaId,
    durationSeconds: video.durationSeconds,
    chapters: video.chapters.map((c) => ({ ...c })),
    transcript: video.transcript
      ? structuredClone(video.transcript)
      : null,
    categoryIds: [...video.categoryIds],
    tagIds: [...video.tagIds],
    audienceIds: [...video.audienceIds],
    relatedArticleIds: [...video.relatedArticleIds],
    relatedPromptIds: [...video.relatedPromptIds],
    ownerId: video.ownerId,
    reviewDueAt: video.reviewDueAt,
    source: structuredClone(video.source),
  };
}
