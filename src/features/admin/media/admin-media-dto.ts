import type { MediaAsset } from "@/domain/content/media";
import { isPubliclyDeliverable } from "@/domain/content/media";

/** Safe admin DTO — no storageKey, signed URLs, bucket, credentials. */
export type AdminMediaDto = {
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
  status: string;
  sourceType: string;
  ownerId: string;
  failureReasonCode: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string | null;
  archivedAt: string | null;
  revision: number;
  publicPath: string | null;
};

export function toAdminMediaDto(media: MediaAsset): AdminMediaDto {
  return {
    id: media.id as string,
    title: media.title as string,
    description: media.description,
    defaultAltText: media.defaultAltText,
    kind: media.kind,
    mimeType: media.mimeType,
    originalFileName: media.originalFileName,
    fileExtension: media.fileExtension,
    sizeBytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    status: media.status,
    sourceType: media.source.type,
    ownerId: media.ownerId as string,
    failureReasonCode: media.failureReasonCode,
    createdAt: media.createdAt as string,
    updatedAt: media.updatedAt as string,
    uploadedAt: (media.uploadedAt as string | null) ?? null,
    archivedAt: (media.archivedAt as string | null) ?? null,
    revision: media.revision as number,
    publicPath: isPubliclyDeliverable(media) ? `/media/${media.id}` : null,
  };
}

export type PublicMediaPresentationDto = {
  mediaId: string;
  url: string;
  mimeType: string;
  kind: string;
  title: string;
  defaultAltText: string | null;
};
