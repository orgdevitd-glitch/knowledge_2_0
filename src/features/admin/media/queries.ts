import "server-only";

import type { MediaStatus } from "@/domain/content/media";
import { NotFoundError } from "@/domain/shared/errors";
import type { AdminPrincipal } from "@/server/auth/principal";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import {
  getContentPorts,
  isContentPersistenceAvailable,
} from "@/server/composition/content-ports";
import { analyzeMediaUsage, type MediaUsageResult } from "@/features/content/application/media-usage";

import { toAdminMediaDto, type AdminMediaDto } from "./admin-media-dto";

export type { AdminAuditSummary } from "@/features/admin/articles/queries";

export type AdminMediaActions = {
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canRetry: boolean;
  /** Reissue signed URL for uploading (same storageKey). */
  canReissue: boolean;
};

export function actionsForMediaStatus(status: MediaStatus): AdminMediaActions {
  return {
    canEdit: status === "ready" || status === "failed",
    canArchive: status === "ready" || status === "failed",
    canRestore: status === "archived",
    canRetry: status === "failed",
    canReissue: status === "uploading",
  };
}

export async function getAdminMediaDetail(
  _principal: AdminPrincipal,
  mediaId: string,
): Promise<{
  media: AdminMediaDto;
  actions: AdminMediaActions;
  usage: MediaUsageResult;
  recentAudit: import("@/features/admin/articles/queries").AdminAuditSummary[];
} | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  if (!ports.media) return null;

  const media = await ports.media.getById(mediaId);
  if (!media) return null;

  const dto = toAdminMediaDto(media);
  const persistence = getAdminPersistence();
  const usage = await analyzeMediaUsage(ports, mediaId);

  const events = persistence.audit
    ? await persistence.audit.listByEntity("media", mediaId)
    : [];
  const recentAudit = events
    .slice()
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, 20)
    .map((e) => ({
      id: e.id as string,
      eventType: e.eventType,
      occurredAt: e.occurredAt as string,
      actorId: e.actorId as string,
      changeSummary:
        typeof e.metadata?.changeSummary === "string"
          ? e.metadata.changeSummary
          : null,
    }));

  return {
    media: dto,
    actions: actionsForMediaStatus(media.status),
    usage,
    recentAudit,
  };
}

export async function requireAdminMedia(
  principal: AdminPrincipal,
  mediaId: string,
): Promise<AdminMediaDto> {
  const detail = await getAdminMediaDetail(principal, mediaId);
  if (!detail) {
    throw new NotFoundError("Media not found", { mediaId });
  }
  return detail.media;
}
