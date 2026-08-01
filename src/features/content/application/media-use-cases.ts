import {
  assertMediaBinaryImmutable,
  createMediaAsset,
  markMediaArchived,
  markMediaReady,
  markMediaRestoredFailed,
  markMediaRestoredReady,
  markMediaRetryUpload,
  markMediaUploadFailed,
  withMediaMetadataUpdate,
  type MediaAsset,
} from "@/domain/content/media";
import { sniffMediaContent } from "@/domain/content/media-sniff";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/domain/shared/errors";
import {
  kindForMime,
  maxBytesForKind,
  MEDIA_MIME_BY_EXTENSION,
  type MediaKindValue,
} from "@/domain/shared/media-limits";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import { getMediaLimits } from "@/config/media-env";
import { generateMediaStorageKey } from "@/server/media/storage-key";
import type { ContentPorts, UseCaseContext } from "./ports";
import { persistMediaMutation } from "./media-persistence";
import { analyzeMediaUsage } from "./media-usage";

function resolveNow(ports: ContentPorts, ctx: UseCaseContext): IsoDateTime {
  return (ctx.now as IsoDateTime | undefined) ?? ports.clock.now();
}

function requireMedia(ports: ContentPorts) {
  if (!ports.media || !ports.mediaStorage) {
    throw new ValidationError("Media persistence is unavailable", {
      adminCode: "PERSISTENCE_UNAVAILABLE",
    });
  }
  return { mediaRepo: ports.media, storage: ports.mediaStorage };
}

function safeAuditMeta(media: MediaAsset, extra?: Record<string, unknown>) {
  return {
    kind: media.kind,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    sourceType: media.source.type,
    failureReasonCode: media.failureReasonCode,
    ...extra,
  };
}

export type MediaUploadSession = {
  media: MediaAsset;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};

/**
 * Start upload recovery contract (Phase 7B acceptance):
 * 1. Mint signed upload capability BEFORE metadata transaction.
 * 2. Atomically persist MediaAsset (uploading) + media.created + media.upload.started.
 * 3. If the transaction fails, the unused signed URL expires safely (no stuck asset).
 * 4. Expired uploading sessions can call reissueMediaUploadUrl (same storageKey).
 * 5. Failed uploads use retryMediaUpload (new storageKey).
 */
export async function startMediaUpload(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: {
    kind: MediaKindValue;
    title: string;
    description?: string | null;
    defaultAltText?: string | null;
    originalFileName: string;
    declaredSizeBytes: number;
  },
): Promise<MediaUploadSession> {
  const { storage } = requireMedia(ports);
  const limits = getMediaLimits();
  const now = resolveNow(ports, ctx);
  const maxBytes = maxBytesForKind(input.kind, limits);

  if (
    !Number.isFinite(input.declaredSizeBytes) ||
    input.declaredSizeBytes <= 0 ||
    input.declaredSizeBytes > maxBytes
  ) {
    throw new ValidationError("Declared file size exceeds limit", {
      adminCode: "VALIDATION_ERROR",
      field: "declaredSizeBytes",
      maxBytes,
    });
  }

  const mediaId = ports.ids.next("media");
  const storageKey = generateMediaStorageKey(mediaId);
  const provider = limits.storageMode === "gcs" ? "gcs" : "memory";

  const media = createMediaAsset({
    id: mediaId,
    title: input.title,
    description: input.description,
    defaultAltText: input.defaultAltText,
    kind: input.kind,
    originalFileName: input.originalFileName,
    storageProvider: provider,
    storageKey,
    ownerId: ctx.actorId,
    now,
    declaredSizeBytes: input.declaredSizeBytes,
  });

  const mapped = MEDIA_MIME_BY_EXTENSION[media.fileExtension];
  if (!mapped || kindForMime(mapped) !== input.kind) {
    throw new ValidationError("File extension is not allowed for this kind", {
      adminCode: "VALIDATION_ERROR",
      field: "originalFileName",
    });
  }

  let signed;
  try {
    signed = await storage.createSignedUploadUrl({
      storageKey: media.storageKey,
      expiresInSeconds: limits.signedUploadTtlSeconds,
      maxBytes,
    });
  } catch {
    throw new ValidationError("Failed to create upload URL", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "SIGNED_URL_FAILED",
    });
  }

  try {
    const saved = await persistMediaMutation(ports, ctx, media, 0, [
      {
        eventType: "media.created",
        occurredAt: now,
        metadata: safeAuditMeta(media),
      },
      {
        eventType: "media.upload.started",
        occurredAt: now,
        metadata: safeAuditMeta(media),
      },
    ]);
    return {
      media: saved,
      uploadUrl: signed.uploadUrl,
      expiresAt: signed.expiresAt,
      requiredHeaders: signed.requiredHeaders,
    };
  } catch (error) {
    // Capability expires unused; no MediaAsset left in a stuck uploading state.
    throw error;
  }
}

export async function completeMediaUpload(
  ports: ContentPorts,
  ctx: UseCaseContext,
  mediaId: string,
  expectedRevision: number,
): Promise<MediaAsset> {
  const { mediaRepo, storage } = requireMedia(ports);
  const limits = getMediaLimits();
  const existing = await mediaRepo.getById(mediaId);
  if (!existing) throw new NotFoundError("Media not found", { mediaId });

  // Idempotent success: already ready for the same object generation.
  if (existing.status === "ready") {
    if (existing.providerGeneration) {
      const live = await storage.stat(existing.storageKey).catch(() => null);
      if (
        live?.exists &&
        live.generation != null &&
        live.generation !== existing.providerGeneration
      ) {
        throw new ConflictError(
          "Ready media object generation mismatch; binary replace is forbidden",
          {
            adminCode: "MEDIA_GENERATION_MISMATCH",
          },
        );
      }
    }
    return existing;
  }

  if (existing.status === "failed") {
    throw new ValidationError(
      "Media upload failed; retry before completing",
      {
        adminCode: "INVALID_STATUS_TRANSITION",
        status: existing.status,
      },
    );
  }

  if (existing.status !== "uploading") {
    throw new ValidationError("Media is not awaiting upload completion", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: existing.status,
    });
  }
  if (existing.revision !== expectedRevision) {
    throw new ConflictError("Optimistic concurrency conflict", {
      expectedRevision,
      actualRevision: existing.revision,
    });
  }

  const now = resolveNow(ports, ctx);
  const maxBytes = maxBytesForKind(existing.kind, limits);

  let stat;
  try {
    stat = await storage.stat(existing.storageKey);
  } catch {
    const failed = markMediaUploadFailed(existing, "OBJECT_STAT_FAILED", now);
    await persistMediaMutation(ports, ctx, failed, expectedRevision, {
      eventType: "media.upload.failed",
      occurredAt: now,
      metadata: safeAuditMeta(failed),
    });
    throw new ValidationError("Uploaded object not found", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "OBJECT_STAT_FAILED",
    });
  }

  if (!stat.exists) {
    const failed = markMediaUploadFailed(existing, "OBJECT_MISSING", now);
    await persistMediaMutation(ports, ctx, failed, expectedRevision, {
      eventType: "media.upload.failed",
      occurredAt: now,
      metadata: safeAuditMeta(failed),
    });
    throw new ValidationError("Uploaded object not found", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "OBJECT_MISSING",
    });
  }

  if (stat.sizeBytes <= 0 || stat.sizeBytes > maxBytes) {
    await storage.deleteObject(existing.storageKey).catch(() => undefined);
    const failed = markMediaUploadFailed(existing, "SIZE_LIMIT_EXCEEDED", now);
    await persistMediaMutation(ports, ctx, failed, expectedRevision, {
      eventType: "media.upload.failed",
      occurredAt: now,
      metadata: safeAuditMeta(failed),
    });
    throw new ValidationError("Uploaded file size is invalid", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "SIZE_LIMIT_EXCEEDED",
    });
  }

  let prefix: Uint8Array;
  try {
    prefix = await storage.readPrefix(
      existing.storageKey,
      limits.sniffPrefixBytes,
    );
  } catch {
    await storage.deleteObject(existing.storageKey).catch(() => undefined);
    const failed = markMediaUploadFailed(existing, "OBJECT_READ_FAILED", now);
    await persistMediaMutation(ports, ctx, failed, expectedRevision, {
      eventType: "media.upload.failed",
      occurredAt: now,
      metadata: safeAuditMeta(failed),
    });
    throw new ValidationError("Failed to read uploaded object", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "OBJECT_READ_FAILED",
    });
  }

  const sniffed = sniffMediaContent({
    prefix,
    fileExtension: existing.fileExtension,
    expectedKind: existing.kind,
  });

  if (!sniffed.ok) {
    await storage.deleteObject(existing.storageKey).catch(() => undefined);
    const failed = markMediaUploadFailed(existing, sniffed.failureReasonCode, now);
    await persistMediaMutation(ports, ctx, failed, expectedRevision, {
      eventType: "media.upload.failed",
      occurredAt: now,
      metadata: safeAuditMeta(failed),
    });
    throw new ValidationError("Uploaded content failed validation", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: sniffed.failureReasonCode,
    });
  }

  const ready = markMediaReady(
    existing,
    {
      mimeType: sniffed.mimeType,
      sizeBytes: stat.sizeBytes,
      providerGeneration: stat.generation,
      providerChecksum: stat.checksumCrc32c,
      providerEtag: stat.etag,
    },
    now,
  );

  try {
    return await persistMediaMutation(ports, ctx, ready, expectedRevision, {
      eventType: "media.upload.completed",
      occurredAt: now,
      metadata: safeAuditMeta(ready),
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      // Concurrent complete won — return current ready state if present.
      const latest = await mediaRepo.getById(mediaId);
      if (latest?.status === "ready") {
        return latest;
      }
    }
    throw error;
  }
}

/**
 * Reissue a signed upload URL for an uploading asset (same storageKey).
 * Used when the previous capability expired before PUT completed.
 */
export async function reissueMediaUploadUrl(
  ports: ContentPorts,
  ctx: UseCaseContext,
  mediaId: string,
  expectedRevision: number,
): Promise<MediaUploadSession> {
  const { mediaRepo, storage } = requireMedia(ports);
  const limits = getMediaLimits();
  const existing = await mediaRepo.getById(mediaId);
  if (!existing) throw new NotFoundError("Media not found", { mediaId });
  assertMediaBinaryImmutable(existing);

  if (existing.status !== "uploading") {
    throw new ValidationError(
      "Only uploading media can reissue an upload URL",
      {
        adminCode: "INVALID_STATUS_TRANSITION",
        status: existing.status,
      },
    );
  }
  if (existing.revision !== expectedRevision) {
    throw new ConflictError("Optimistic concurrency conflict", {
      expectedRevision,
      actualRevision: existing.revision,
    });
  }

  const maxBytes = maxBytesForKind(existing.kind, limits);
  let signed;
  try {
    signed = await storage.createSignedUploadUrl({
      storageKey: existing.storageKey,
      expiresInSeconds: limits.signedUploadTtlSeconds,
      maxBytes,
    });
  } catch {
    throw new ValidationError("Failed to create upload URL", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "SIGNED_URL_FAILED",
    });
  }

  // No metadata mutation — capability refresh only (idempotent for revision).
  void ctx;
  return {
    media: existing,
    uploadUrl: signed.uploadUrl,
    expiresAt: signed.expiresAt,
    requiredHeaders: signed.requiredHeaders,
  };
}

export async function retryMediaUpload(
  ports: ContentPorts,
  ctx: UseCaseContext,
  mediaId: string,
  expectedRevision: number,
): Promise<MediaUploadSession> {
  const { mediaRepo, storage } = requireMedia(ports);
  const limits = getMediaLimits();
  const existing = await mediaRepo.getById(mediaId);
  if (!existing) throw new NotFoundError("Media not found", { mediaId });
  assertMediaBinaryImmutable(existing);

  if (existing.status !== "failed") {
    throw new ValidationError("Only failed media can retry upload", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: existing.status,
    });
  }
  if (existing.revision !== expectedRevision) {
    throw new ConflictError("Optimistic concurrency conflict", {
      expectedRevision,
      actualRevision: existing.revision,
    });
  }

  const oldKey = existing.storageKey;
  const now = resolveNow(ports, ctx);
  const newKey = generateMediaStorageKey(existing.id);
  const maxBytes = maxBytesForKind(existing.kind, limits);
  const retried = markMediaRetryUpload(existing, newKey, now);

  let signed;
  try {
    signed = await storage.createSignedUploadUrl({
      storageKey: newKey,
      expiresInSeconds: limits.signedUploadTtlSeconds,
      maxBytes,
    });
  } catch {
    // Leave asset in failed; retry can be attempted again.
    throw new ValidationError("Failed to create upload URL", {
      adminCode: "MEDIA_UPLOAD_FAILED",
      failureReasonCode: "SIGNED_URL_FAILED",
    });
  }

  const saved = await persistMediaMutation(
    ports,
    ctx,
    retried,
    expectedRevision,
    {
      eventType: "media.upload.started",
      occurredAt: now,
      metadata: safeAuditMeta(retried, { retry: true }),
    },
  );

  await storage.deleteObject(oldKey).catch(() => undefined);

  return {
    media: saved,
    uploadUrl: signed.uploadUrl,
    expiresAt: signed.expiresAt,
    requiredHeaders: signed.requiredHeaders,
  };
}

export async function updateMediaMetadata(
  ports: ContentPorts,
  ctx: UseCaseContext,
  mediaId: string,
  expectedRevision: number,
  patch: {
    title?: string;
    description?: string | null;
    defaultAltText?: string | null;
  },
): Promise<MediaAsset> {
  const { mediaRepo } = requireMedia(ports);
  const existing = await mediaRepo.getById(mediaId);
  if (!existing) throw new NotFoundError("Media not found", { mediaId });
  const now = resolveNow(ports, ctx);
  const next = withMediaMetadataUpdate(existing, patch, now);
  return persistMediaMutation(ports, ctx, next, expectedRevision, {
    eventType: "media.metadata.updated",
    occurredAt: now,
    metadata: safeAuditMeta(next),
  });
}

export async function archiveMedia(
  ports: ContentPorts,
  ctx: UseCaseContext,
  mediaId: string,
  expectedRevision: number,
): Promise<MediaAsset> {
  const { mediaRepo } = requireMedia(ports);
  const existing = await mediaRepo.getById(mediaId);
  if (!existing) throw new NotFoundError("Media not found", { mediaId });

  let usage;
  try {
    usage = await analyzeMediaUsage(ports, mediaId);
  } catch {
    throw new ValidationError(
      "Usage scan failed; archive blocked until scan can complete",
      { adminCode: "MEDIA_USAGE_SCAN_FAILED" },
    );
  }
  if (usage.scanLimitExceeded) {
    throw new ValidationError(
      "Usage scan incomplete; archive blocked until scan can complete",
      { adminCode: "MEDIA_USAGE_SCAN_INCOMPLETE" },
    );
  }
  if (usage.totalReferences > 0) {
    throw new ValidationError(
      "Media is still referenced by content; remove references before archive",
      {
        adminCode: "MEDIA_IN_USE",
        totalReferences: usage.totalReferences,
      },
    );
  }

  const now = resolveNow(ports, ctx);
  const archived = markMediaArchived(existing, now);
  return persistMediaMutation(ports, ctx, archived, expectedRevision, {
    eventType: "media.archived",
    occurredAt: now,
    metadata: safeAuditMeta(archived),
  });
}

export async function restoreMedia(
  ports: ContentPorts,
  ctx: UseCaseContext,
  mediaId: string,
  expectedRevision: number,
): Promise<MediaAsset> {
  const { mediaRepo, storage } = requireMedia(ports);
  const existing = await mediaRepo.getById(mediaId);
  if (!existing) throw new NotFoundError("Media not found", { mediaId });
  if (existing.status !== "archived") {
    throw new ValidationError("Only archived media can be restored", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }

  const now = resolveNow(ports, ctx);
  const stat = await storage.stat(existing.storageKey).catch(() => null);
  const generationOk =
    !existing.providerGeneration ||
    (stat?.generation != null &&
      stat.generation === existing.providerGeneration);
  const checksumOk =
    !existing.providerChecksum ||
    (stat?.checksumCrc32c != null &&
      stat.checksumCrc32c === existing.providerChecksum);

  if (
    !stat?.exists ||
    (existing.sizeBytes != null && stat.sizeBytes !== existing.sizeBytes) ||
    !generationOk ||
    !checksumOk
  ) {
    const failed = markMediaRestoredFailed(
      existing,
      "RESTORE_OBJECT_INVALID",
      now,
    );
    return persistMediaMutation(ports, ctx, failed, expectedRevision, {
      eventType: "media.restored",
      occurredAt: now,
      metadata: safeAuditMeta(failed),
    });
  }

  const restored = markMediaRestoredReady(existing, now);
  return persistMediaMutation(ports, ctx, restored, expectedRevision, {
    eventType: "media.restored",
    occurredAt: now,
    metadata: safeAuditMeta(restored),
  });
}

export async function getMedia(
  ports: ContentPorts,
  mediaId: string,
): Promise<MediaAsset> {
  const { mediaRepo } = requireMedia(ports);
  const media = await mediaRepo.getById(mediaId);
  if (!media) throw new NotFoundError("Media not found", { mediaId });
  return media;
}
