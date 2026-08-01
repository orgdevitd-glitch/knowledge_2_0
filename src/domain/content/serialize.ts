import { ValidationError } from "../shared/errors";
import type { Article, ArticleSnapshot } from "./article";
import {
  applyArticleVersionSnapshot,
  createArticle,
  toArticleSnapshot,
} from "./article";
import { validateBlocks } from "./blocks";
import type { Prompt, PromptSnapshot } from "./prompt";
import {
  applyPromptVersionSnapshot,
  createPrompt,
} from "./prompt";
import { parseSourceReference } from "./source";
import type { ContentVersion, VersionSnapshot } from "./versioning";
import {
  createContentVersion,
  ensureSerializableSnapshot,
} from "./versioning";
import type { Video } from "./video";
import { createVideo } from "./video";
import type { MediaAsset, MediaStorageProvider } from "./media";
import { rehydrateMediaAsset } from "./media";
import type { IsoDateTime, Revision } from "../shared/value-objects";
import { parseIsoDateTime, parseRevision } from "../shared/value-objects";
import type { ContentStatus } from "../shared/status";
import { VersionId } from "../shared/ids";

export type SerializedMediaAsset = Record<string, unknown>;

const CONTENT_STATUSES = new Set([
  "draft",
  "published",
  "hidden",
  "archived",
]);

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${label} must be a plain object`);
  }
  return value as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string") {
    throw new ValidationError(`Missing or invalid field: ${key}`);
  }
  return v;
}

function optionalString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    throw new ValidationError(`Invalid field: ${key}`);
  }
  return v;
}

function requireStatus(obj: Record<string, unknown>): ContentStatus {
  const status = requireString(obj, "status");
  if (!CONTENT_STATUSES.has(status)) {
    throw new ValidationError("Unknown content status", { status });
  }
  return status as ContentStatus;
}

export type SerializedArticle = Record<string, unknown>;
export type SerializedPrompt = Record<string, unknown>;
export type SerializedVideo = Record<string, unknown>;
export type SerializedContentVersion = Record<string, unknown>;

export function serializeArticle(article: Article): SerializedArticle {
  return JSON.parse(
    JSON.stringify({
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      coverMediaId: article.coverMediaId,
      categoryIds: article.categoryIds,
      tagIds: article.tagIds,
      audienceIds: article.audienceIds,
      ownerId: article.ownerId,
      authorId: article.authorId,
      status: article.status,
      blocks: article.blocks,
      relatedArticleIds: article.relatedArticleIds,
      relatedPromptIds: article.relatedPromptIds,
      relatedVideoIds: article.relatedVideoIds,
      source: article.source,
      currentVersion: article.currentVersion,
      publishedVersion: article.publishedVersion,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      publishedAt: article.publishedAt,
      reviewDueAt: article.reviewDueAt,
      revision: article.revision,
    }),
  ) as SerializedArticle;
}

export function deserializeArticle(raw: unknown): Article {
  const obj = assertPlainObject(raw, "Article");
  const knownKeys = new Set([
    "id",
    "slug",
    "title",
    "summary",
    "coverMediaId",
    "categoryIds",
    "tagIds",
    "audienceIds",
    "ownerId",
    "authorId",
    "status",
    "blocks",
    "relatedArticleIds",
    "relatedPromptIds",
    "relatedVideoIds",
    "source",
    "currentVersion",
    "publishedVersion",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "reviewDueAt",
    "revision",
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      throw new ValidationError("Unknown article field", { key });
    }
  }

  const blocks = validateBlocks(
    Array.isArray(obj.blocks) ? (obj.blocks as unknown[]) : [],
  );
  const created = createArticle({
    id: requireString(obj, "id"),
    slug: requireString(obj, "slug"),
    title: requireString(obj, "title"),
    summary: optionalString(obj, "summary"),
    coverMediaId: optionalString(obj, "coverMediaId"),
    categoryIds: (obj.categoryIds as string[]) ?? [],
    tagIds: (obj.tagIds as string[]) ?? [],
    audienceIds: (obj.audienceIds as string[]) ?? [],
    ownerId: optionalString(obj, "ownerId"),
    authorId: optionalString(obj, "authorId"),
    blocks,
    relatedArticleIds: (obj.relatedArticleIds as string[]) ?? [],
    relatedPromptIds: (obj.relatedPromptIds as string[]) ?? [],
    relatedVideoIds: (obj.relatedVideoIds as string[]) ?? [],
    source: obj.source
      ? parseSourceReference(obj.source)
      : undefined,
    reviewDueAt: optionalString(obj, "reviewDueAt"),
    now: parseIsoDateTime(requireString(obj, "createdAt")),
  });

  return {
    ...created,
    status: requireStatus(obj),
    currentVersion: obj.currentVersion
      ? VersionId.parse(obj.currentVersion)
      : null,
    publishedVersion: obj.publishedVersion
      ? VersionId.parse(obj.publishedVersion)
      : null,
    createdAt: parseIsoDateTime(requireString(obj, "createdAt")),
    updatedAt: parseIsoDateTime(requireString(obj, "updatedAt")),
    publishedAt: obj.publishedAt
      ? parseIsoDateTime(obj.publishedAt)
      : null,
    revision: parseRevision(obj.revision ?? 0),
  };
}

export function serializePrompt(prompt: Prompt): SerializedPrompt {
  return JSON.parse(JSON.stringify({ ...prompt })) as SerializedPrompt;
}

export function deserializePrompt(raw: unknown): Prompt {
  const obj = assertPlainObject(raw, "Prompt");
  const knownKeys = new Set([
    "id",
    "slug",
    "title",
    "summary",
    "categoryIds",
    "tagIds",
    "audienceIds",
    "promptText",
    "inputRequirements",
    "outputRequirements",
    "restrictions",
    "usageExample",
    "relatedArticleIds",
    "relatedVideoIds",
    "status",
    "currentVersion",
    "publishedVersion",
    "ownerId",
    "source",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "reviewDueAt",
    "revision",
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      throw new ValidationError("Unknown prompt field", { key });
    }
  }

  const created = createPrompt({
    id: requireString(obj, "id"),
    slug: requireString(obj, "slug"),
    title: requireString(obj, "title"),
    summary: optionalString(obj, "summary"),
    categoryIds: (obj.categoryIds as string[]) ?? [],
    tagIds: (obj.tagIds as string[]) ?? [],
    audienceIds: (obj.audienceIds as string[]) ?? [],
    promptText: requireString(obj, "promptText"),
    inputRequirements: optionalString(obj, "inputRequirements"),
    outputRequirements: optionalString(obj, "outputRequirements"),
    restrictions: optionalString(obj, "restrictions"),
    usageExample: optionalString(obj, "usageExample"),
    relatedArticleIds: (obj.relatedArticleIds as string[]) ?? [],
    relatedVideoIds: (obj.relatedVideoIds as string[]) ?? [],
    ownerId: optionalString(obj, "ownerId"),
    reviewDueAt: optionalString(obj, "reviewDueAt"),
    source: obj.source ? parseSourceReference(obj.source) : undefined,
    now: parseIsoDateTime(requireString(obj, "createdAt")),
  });

  return {
    ...created,
    status: requireStatus(obj),
    currentVersion: obj.currentVersion
      ? VersionId.parse(obj.currentVersion)
      : null,
    publishedVersion: obj.publishedVersion
      ? VersionId.parse(obj.publishedVersion)
      : null,
    createdAt: parseIsoDateTime(requireString(obj, "createdAt")),
    updatedAt: parseIsoDateTime(requireString(obj, "updatedAt")),
    publishedAt: obj.publishedAt
      ? parseIsoDateTime(obj.publishedAt)
      : null,
    revision: parseRevision(obj.revision ?? 0),
    source: obj.source
      ? parseSourceReference(obj.source)
      : created.source,
  };
}

export function serializeVideo(video: Video): SerializedVideo {
  return JSON.parse(JSON.stringify({ ...video })) as SerializedVideo;
}

export function deserializeVideo(raw: unknown): Video {
  const obj = assertPlainObject(raw, "Video");
  const knownKeys = new Set([
    "id",
    "slug",
    "title",
    "summary",
    "source",
    "mediaId",
    "externalUrl",
    "posterMediaId",
    "durationSeconds",
    "chapters",
    "transcript",
    "categoryIds",
    "tagIds",
    "audienceIds",
    "relatedArticleIds",
    "relatedPromptIds",
    "status",
    "currentVersion",
    "publishedVersion",
    "ownerId",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "reviewDueAt",
    "revision",
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      throw new ValidationError("Unknown video field", { key });
    }
  }

  const created = createVideo({
    id: requireString(obj, "id"),
    slug: requireString(obj, "slug"),
    title: requireString(obj, "title"),
    summary: optionalString(obj, "summary"),
    source: obj.source ? parseSourceReference(obj.source) : undefined,
    mediaId: optionalString(obj, "mediaId"),
    externalUrl: optionalString(obj, "externalUrl"),
    posterMediaId: optionalString(obj, "posterMediaId"),
    durationSeconds:
      typeof obj.durationSeconds === "number" || obj.durationSeconds === null
        ? (obj.durationSeconds as number | null)
        : null,
    chapters: (obj.chapters as Video["chapters"]) ?? [],
    transcript: (obj.transcript as Video["transcript"]) ?? null,
    categoryIds: (obj.categoryIds as string[]) ?? [],
    tagIds: (obj.tagIds as string[]) ?? [],
    audienceIds: (obj.audienceIds as string[]) ?? [],
    relatedArticleIds: (obj.relatedArticleIds as string[]) ?? [],
    relatedPromptIds: (obj.relatedPromptIds as string[]) ?? [],
    ownerId: optionalString(obj, "ownerId"),
    reviewDueAt: optionalString(obj, "reviewDueAt"),
    now: parseIsoDateTime(requireString(obj, "createdAt")),
  });

  return {
    ...created,
    status: requireStatus(obj),
    currentVersion: obj.currentVersion
      ? VersionId.parse(obj.currentVersion)
      : null,
    publishedVersion: obj.publishedVersion
      ? VersionId.parse(obj.publishedVersion)
      : null,
    createdAt: parseIsoDateTime(requireString(obj, "createdAt")),
    updatedAt: parseIsoDateTime(requireString(obj, "updatedAt")),
    publishedAt: obj.publishedAt
      ? parseIsoDateTime(obj.publishedAt)
      : null,
    revision: parseRevision(obj.revision ?? 0),
  };
}

export function serializeContentVersion(
  version: ContentVersion,
): SerializedContentVersion {
  return JSON.parse(JSON.stringify({ ...version })) as SerializedContentVersion;
}

export function deserializeContentVersion(raw: unknown): ContentVersion {
  const obj = assertPlainObject(raw, "ContentVersion");
  const knownKeys = new Set([
    "id",
    "entityType",
    "entityId",
    "versionNumber",
    "snapshot",
    "changeSummary",
    "source",
    "createdBy",
    "createdAt",
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      throw new ValidationError("Unknown version field", { key });
    }
  }

  const entityType = requireString(obj, "entityType");
  if (
    entityType !== "article" &&
    entityType !== "prompt" &&
    entityType !== "video"
  ) {
    throw new ValidationError("Unknown version entityType", { entityType });
  }

  return createContentVersion({
    id: requireString(obj, "id"),
    entityType,
    entityId: requireString(obj, "entityId"),
    versionNumber: obj.versionNumber as number,
    snapshot: ensureSerializableSnapshot(
      assertPlainObject(obj.snapshot, "snapshot") as VersionSnapshot,
    ),
    changeSummary: optionalString(obj, "changeSummary"),
    createdBy: requireString(obj, "createdBy"),
    createdAt: parseIsoDateTime(requireString(obj, "createdAt")),
  });
}

export function snapshotFromSerializedArticle(
  article: Article,
): ArticleSnapshot {
  return toArticleSnapshot(article);
}

export function restoreArticleFromSnapshot(
  article: Article,
  snapshot: ArticleSnapshot,
  now: IsoDateTime,
): Article {
  return applyArticleVersionSnapshot(article, snapshot, now);
}

export function restorePromptFromSnapshot(
  prompt: Prompt,
  snapshot: PromptSnapshot,
  now: IsoDateTime,
): Prompt {
  return applyPromptVersionSnapshot(prompt, snapshot, now);
}

export function serializeMediaAsset(media: MediaAsset): SerializedMediaAsset {
  return JSON.parse(JSON.stringify({ ...media })) as SerializedMediaAsset;
}

export function deserializeMediaAsset(raw: unknown): MediaAsset {
  const obj = assertPlainObject(raw, "MediaAsset");
  const knownKeys = new Set([
    "id",
    "title",
    "description",
    "defaultAltText",
    "kind",
    "mimeType",
    "originalFileName",
    "fileExtension",
    "sizeBytes",
    "width",
    "height",
    "storageProvider",
    "storageKey",
    "providerGeneration",
    "providerChecksum",
    "providerEtag",
    "status",
    "source",
    "ownerId",
    "failureReasonCode",
    "createdAt",
    "updatedAt",
    "uploadedAt",
    "archivedAt",
    "revision",
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      throw new ValidationError("Unknown media field", { key });
    }
  }
  const provider = requireString(obj, "storageProvider");
  if (provider !== "gcs" && provider !== "memory") {
    throw new ValidationError("Invalid storageProvider");
  }
  return rehydrateMediaAsset({
    id: requireString(obj, "id"),
    title: requireString(obj, "title"),
    description: optionalString(obj, "description"),
    defaultAltText: optionalString(obj, "defaultAltText"),
    kind: requireString(obj, "kind"),
    mimeType: optionalString(obj, "mimeType"),
    originalFileName: requireString(obj, "originalFileName"),
    fileExtension: requireString(obj, "fileExtension"),
    sizeBytes:
      typeof obj.sizeBytes === "number" || obj.sizeBytes === null
        ? (obj.sizeBytes as number | null)
        : null,
    width:
      typeof obj.width === "number" || obj.width === null
        ? (obj.width as number | null)
        : null,
    height:
      typeof obj.height === "number" || obj.height === null
        ? (obj.height as number | null)
        : null,
    storageProvider: provider as MediaStorageProvider,
    storageKey: requireString(obj, "storageKey"),
    providerGeneration: optionalString(obj, "providerGeneration"),
    providerChecksum: optionalString(obj, "providerChecksum"),
    providerEtag: optionalString(obj, "providerEtag"),
    status: requireString(obj, "status"),
    source: obj.source
      ? parseSourceReference(obj.source)
      : { type: "portal" },
    ownerId: requireString(obj, "ownerId"),
    failureReasonCode: optionalString(obj, "failureReasonCode"),
    createdAt: requireString(obj, "createdAt"),
    updatedAt: requireString(obj, "updatedAt"),
    uploadedAt: optionalString(obj, "uploadedAt"),
    archivedAt: optionalString(obj, "archivedAt"),
    revision: parseRevision(obj.revision ?? 0),
  });
}

export type { Revision };
