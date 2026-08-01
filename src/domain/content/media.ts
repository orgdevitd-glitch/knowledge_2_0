import { ValidationError } from "../shared/errors";
import type { MediaId, UserId } from "../shared/ids";
import { MediaId as MediaIdP, UserId as UserIdP } from "../shared/ids";
import {
  MEDIA_KIND_VALUES,
  MEDIA_LIMIT_DEFAULTS,
  MEDIA_STATUS_VALUES,
  type MediaKindValue,
  type MediaStatusValue,
} from "../shared/media-limits";
import type {
  IsoDateTime,
  Revision,
  Title,
} from "../shared/value-objects";
import {
  initialRevision,
  nextRevision,
  parseIsoDateTime,
  parseTitle,
} from "../shared/value-objects";
import { portalSource, type SourceReference } from "./source";
import {
  extractFileExtension,
  sanitizeOriginalFileName,
} from "./media-sniff";

export type MediaKind = MediaKindValue;
export type MediaStatus = MediaStatusValue;
export type MediaStorageProvider = "gcs" | "memory";

export type MediaAsset = {
  id: MediaId;
  title: Title;
  description: string | null;
  defaultAltText: string | null;
  kind: MediaKind;
  mimeType: string | null;
  originalFileName: string;
  fileExtension: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  storageProvider: MediaStorageProvider;
  storageKey: string;
  providerGeneration: string | null;
  providerChecksum: string | null;
  providerEtag: string | null;
  status: MediaStatus;
  source: SourceReference;
  ownerId: UserId;
  failureReasonCode: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  uploadedAt: IsoDateTime | null;
  archivedAt: IsoDateTime | null;
  revision: Revision;
};

function parseKind(value: string): MediaKind {
  if (!(MEDIA_KIND_VALUES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid media kind", { kind: value });
  }
  return value as MediaKind;
}

function parseStatus(value: string): MediaStatus {
  if (!(MEDIA_STATUS_VALUES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid media status", { status: value });
  }
  return value as MediaStatus;
}

function parseOptionalText(
  value: string | null | undefined,
  max: number,
  field: string,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new ValidationError(`${field} exceeds max length`, {
      field,
      max,
    });
  }
  return trimmed;
}

export function createMediaAsset(input: {
  id: string;
  title: string;
  description?: string | null;
  defaultAltText?: string | null;
  kind: string;
  originalFileName: string;
  storageProvider: MediaStorageProvider;
  storageKey: string;
  ownerId: string;
  source?: SourceReference;
  now: IsoDateTime;
  declaredSizeBytes?: number;
}): MediaAsset {
  const kind = parseKind(input.kind);
  const originalFileName = sanitizeOriginalFileName(
    input.originalFileName,
    MEDIA_LIMIT_DEFAULTS.originalFileNameMax,
  );
  const fileExtension = extractFileExtension(originalFileName);
  if (!fileExtension) {
    throw new ValidationError("File extension is required", {
      adminCode: "VALIDATION_ERROR",
      field: "originalFileName",
    });
  }
  if (
    !input.storageKey ||
    input.storageKey.includes("..") ||
    input.storageKey.includes("\\") ||
    input.storageKey.startsWith("/")
  ) {
    throw new ValidationError("Invalid storage key", {
      adminCode: "VALIDATION_ERROR",
    });
  }

  return {
    id: MediaIdP.parse(input.id),
    title: parseTitle(input.title),
    description: parseOptionalText(
      input.description,
      MEDIA_LIMIT_DEFAULTS.descriptionMax,
      "description",
    ),
    defaultAltText: parseOptionalText(
      input.defaultAltText,
      MEDIA_LIMIT_DEFAULTS.defaultAltTextMax,
      "defaultAltText",
    ),
    kind,
    mimeType: null,
    originalFileName,
    fileExtension,
    sizeBytes:
      input.declaredSizeBytes != null && Number.isFinite(input.declaredSizeBytes)
        ? Math.floor(input.declaredSizeBytes)
        : null,
    width: null,
    height: null,
    storageProvider: input.storageProvider,
    storageKey: input.storageKey,
    providerGeneration: null,
    providerChecksum: null,
    providerEtag: null,
    status: "uploading",
    source: input.source ?? portalSource(),
    ownerId: UserIdP.parse(input.ownerId),
    failureReasonCode: null,
    createdAt: input.now,
    updatedAt: input.now,
    uploadedAt: null,
    archivedAt: null,
    revision: initialRevision(),
  };
}

export function markMediaUploadFailed(
  media: MediaAsset,
  failureReasonCode: string,
  now: IsoDateTime,
): MediaAsset {
  if (media.status !== "uploading" && media.status !== "failed") {
    throw new ValidationError("Cannot mark media failed from current status", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: media.status,
    });
  }
  const code = failureReasonCode
    .trim()
    .slice(0, MEDIA_LIMIT_DEFAULTS.failureReasonCodeMax);
  return {
    ...media,
    status: "failed",
    failureReasonCode: code || "UPLOAD_FAILED",
    updatedAt: now,
    revision: nextRevision(media.revision),
  };
}

export function markMediaReady(
  media: MediaAsset,
  input: {
    mimeType: string;
    sizeBytes: number;
    providerGeneration: string | null;
    providerChecksum: string | null;
    providerEtag: string | null;
    width?: number | null;
    height?: number | null;
  },
  now: IsoDateTime,
): MediaAsset {
  if (media.status !== "uploading") {
    throw new ValidationError("Only uploading media can become ready", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: media.status,
    });
  }
  return {
    ...media,
    status: "ready",
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    providerGeneration: input.providerGeneration,
    providerChecksum: input.providerChecksum,
    providerEtag: input.providerEtag,
    width: input.width ?? null,
    height: input.height ?? null,
    failureReasonCode: null,
    uploadedAt: now,
    updatedAt: now,
    archivedAt: null,
    revision: nextRevision(media.revision),
  };
}

/**
 * Retry failed upload: new storageKey only. Ready binary is immutable.
 */
export function markMediaRetryUpload(
  media: MediaAsset,
  newStorageKey: string,
  now: IsoDateTime,
): MediaAsset {
  if (media.status !== "failed") {
    throw new ValidationError("Only failed media can retry upload", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: media.status,
    });
  }
  if (
    !newStorageKey ||
    newStorageKey.includes("..") ||
    newStorageKey === media.storageKey
  ) {
    throw new ValidationError("Retry requires a new storage key", {
      adminCode: "VALIDATION_ERROR",
    });
  }
  return {
    ...media,
    status: "uploading",
    storageKey: newStorageKey,
    mimeType: null,
    sizeBytes: null,
    width: null,
    height: null,
    providerGeneration: null,
    providerChecksum: null,
    providerEtag: null,
    failureReasonCode: null,
    uploadedAt: null,
    archivedAt: null,
    updatedAt: now,
    revision: nextRevision(media.revision),
  };
}

export function markMediaArchived(
  media: MediaAsset,
  now: IsoDateTime,
): MediaAsset {
  if (media.status !== "ready" && media.status !== "failed") {
    throw new ValidationError("Only ready or failed media can be archived", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: media.status,
    });
  }
  return {
    ...media,
    status: "archived",
    archivedAt: now,
    updatedAt: now,
    revision: nextRevision(media.revision),
  };
}

export function markMediaRestoredReady(
  media: MediaAsset,
  now: IsoDateTime,
): MediaAsset {
  if (media.status !== "archived") {
    throw new ValidationError("Only archived media can be restored", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: media.status,
    });
  }
  return {
    ...media,
    status: "ready",
    archivedAt: null,
    failureReasonCode: null,
    updatedAt: now,
    revision: nextRevision(media.revision),
  };
}

export function markMediaRestoredFailed(
  media: MediaAsset,
  failureReasonCode: string,
  now: IsoDateTime,
): MediaAsset {
  if (media.status !== "archived") {
    throw new ValidationError("Only archived media can be restored", {
      adminCode: "INVALID_STATUS_TRANSITION",
      status: media.status,
    });
  }
  return {
    ...media,
    status: "failed",
    failureReasonCode: failureReasonCode
      .trim()
      .slice(0, MEDIA_LIMIT_DEFAULTS.failureReasonCodeMax),
    archivedAt: null,
    updatedAt: now,
    revision: nextRevision(media.revision),
  };
}

export function withMediaMetadataUpdate(
  media: MediaAsset,
  patch: {
    title?: string;
    description?: string | null;
    defaultAltText?: string | null;
  },
  now: IsoDateTime,
): MediaAsset {
  if (media.status === "uploading") {
    throw new ValidationError("Cannot edit metadata while uploading", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return {
    ...media,
    title: patch.title !== undefined ? parseTitle(patch.title) : media.title,
    description:
      patch.description !== undefined
        ? parseOptionalText(
            patch.description,
            MEDIA_LIMIT_DEFAULTS.descriptionMax,
            "description",
          )
        : media.description,
    defaultAltText:
      patch.defaultAltText !== undefined
        ? parseOptionalText(
            patch.defaultAltText,
            MEDIA_LIMIT_DEFAULTS.defaultAltTextMax,
            "defaultAltText",
          )
        : media.defaultAltText,
    updatedAt: now,
    revision: nextRevision(media.revision),
  };
}

export function assertMediaBinaryImmutable(media: MediaAsset): void {
  if (media.status === "ready") {
    throw new ValidationError(
      "Ready media binary cannot be replaced; create a new MediaAsset",
      { adminCode: "MEDIA_BINARY_IMMUTABLE" },
    );
  }
}

export function isPubliclyDeliverable(media: MediaAsset): boolean {
  return media.status === "ready";
}

export function rehydrateMediaAsset(raw: {
  id: string;
  title: string;
  description: string | null;
  defaultAltText: string | null;
  kind: string;
  mimeType: string | null;
  originalFileName: string;
  fileExtension: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  storageProvider: MediaStorageProvider;
  storageKey: string;
  providerGeneration: string | null;
  providerChecksum: string | null;
  providerEtag: string | null;
  status: string;
  source: SourceReference;
  ownerId: string;
  failureReasonCode: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string | null;
  archivedAt: string | null;
  revision: number;
}): MediaAsset {
  return {
    id: MediaIdP.parse(raw.id),
    title: parseTitle(raw.title),
    description: raw.description,
    defaultAltText: raw.defaultAltText,
    kind: parseKind(raw.kind),
    mimeType: raw.mimeType,
    originalFileName: raw.originalFileName,
    fileExtension: raw.fileExtension,
    sizeBytes: raw.sizeBytes,
    width: raw.width,
    height: raw.height,
    storageProvider: raw.storageProvider,
    storageKey: raw.storageKey,
    providerGeneration: raw.providerGeneration,
    providerChecksum: raw.providerChecksum,
    providerEtag: raw.providerEtag,
    status: parseStatus(raw.status),
    source: raw.source,
    ownerId: UserIdP.parse(raw.ownerId),
    failureReasonCode: raw.failureReasonCode,
    createdAt: parseIsoDateTime(raw.createdAt),
    updatedAt: parseIsoDateTime(raw.updatedAt),
    uploadedAt: raw.uploadedAt ? parseIsoDateTime(raw.uploadedAt) : null,
    archivedAt: raw.archivedAt ? parseIsoDateTime(raw.archivedAt) : null,
    revision: raw.revision as Revision,
  };
}
