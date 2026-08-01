import { createAuditEvent } from "@/domain/content/audit";
import {
  assertVideoPublishable,
  createVideo,
  markVideoArchived,
  markVideoHidden,
  markVideoPublished,
  toVideoSnapshot,
  withVideoUpdate,
  type Video,
} from "@/domain/content/video";
import {
  createContentVersion,
  nextVersionNumber,
} from "@/domain/content/versioning";
import { DuplicateSlugError, NotFoundError } from "@/domain/shared/errors";
import { assertStatusTransition } from "@/domain/shared/status";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type {
  ContentListFilter,
  PaginationInput,
} from "@/server/repositories/interfaces/types";
import type { ContentPorts, UseCaseContext } from "./ports";

function resolveNow(ports: ContentPorts, ctx: UseCaseContext): IsoDateTime {
  return (ctx.now as IsoDateTime | undefined) ?? ports.clock.now();
}

async function audit(
  ports: ContentPorts,
  ctx: UseCaseContext,
  eventType: Parameters<typeof createAuditEvent>[0]["eventType"],
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType,
      entityType: "video",
      entityId,
      actorId: ctx.actorId,
      occurredAt: resolveNow(ports, ctx),
      metadata: { requestId: ctx.requestId, ...metadata },
    }),
  );
}

export async function createVideoUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: Omit<Parameters<typeof createVideo>[0], "id" | "now"> & {
    id?: string;
  },
): Promise<Video> {
  const now = resolveNow(ports, ctx);
  const id = input.id ?? ports.ids.next("video");
  if (await ports.videos.existsBySlug(input.slug)) {
    throw new DuplicateSlugError("Video slug already exists", {
      slug: input.slug,
    });
  }
  const video = createVideo({ ...input, id, now });
  const saved = await ports.videos.save(video, { expectedRevision: 0 });
  await audit(ports, ctx, "content.created", saved.id);
  return saved;
}

export async function updateVideo(
  ports: ContentPorts,
  ctx: UseCaseContext,
  videoId: string,
  expectedRevision: number,
  patch: Parameters<typeof withVideoUpdate>[1],
): Promise<Video> {
  const existing = await ports.videos.getById(videoId);
  if (!existing) throw new NotFoundError("Video not found", { videoId });
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.videos.existsBySlug(patch.slug, videoId)) {
      throw new DuplicateSlugError("Video slug already exists", {
        slug: patch.slug,
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const saved = await ports.videos.save(
    withVideoUpdate(existing, patch, now),
    { expectedRevision },
  );
  await audit(ports, ctx, "content.updated", saved.id);
  return saved;
}

export async function publishVideo(
  ports: ContentPorts,
  ctx: UseCaseContext,
  videoId: string,
  expectedRevision: number,
  changeSummary?: string,
): Promise<{ video: Video; versionId: string }> {
  return ports.uow.run(async () => {
    const existing = await ports.videos.getById(videoId);
    if (!existing) throw new NotFoundError("Video not found", { videoId });
    if (existing.status === "published") {
      // Republish while remaining published.
    } else {
      assertStatusTransition(existing.status, "published");
    }
    assertVideoPublishable(existing);
    const now = resolveNow(ports, ctx);
    const latest = await ports.versions.getLatestByEntity("video", videoId);
    const versionNumber = nextVersionNumber(
      latest ? latest.versionNumber : null,
    );
    const version = createContentVersion({
      id: ports.ids.next("version"),
      entityType: "video",
      entityId: videoId,
      versionNumber,
      snapshot: toVideoSnapshot(existing) as unknown as Record<string, unknown>,
      changeSummary: changeSummary ?? null,
      createdBy: ctx.actorId,
      createdAt: now,
    });
    await ports.versions.saveImmutable(version);
    const published = markVideoPublished(existing, version.id, now);
    const saved = await ports.videos.save(published, { expectedRevision });
    await audit(ports, ctx, "content.published", saved.id, {
      versionId: version.id,
      versionNumber,
    });
    return { video: saved, versionId: version.id };
  });
}

export async function hideVideo(
  ports: ContentPorts,
  ctx: UseCaseContext,
  videoId: string,
  expectedRevision: number,
): Promise<Video> {
  const existing = await ports.videos.getById(videoId);
  if (!existing) throw new NotFoundError("Video not found", { videoId });
  assertStatusTransition(existing.status, "hidden");
  const now = resolveNow(ports, ctx);
  const saved = await ports.videos.save(markVideoHidden(existing, now), {
    expectedRevision,
  });
  await audit(ports, ctx, "content.hidden", saved.id);
  return saved;
}

export async function archiveVideo(
  ports: ContentPorts,
  ctx: UseCaseContext,
  videoId: string,
  expectedRevision: number,
): Promise<Video> {
  const existing = await ports.videos.getById(videoId);
  if (!existing) throw new NotFoundError("Video not found", { videoId });
  assertStatusTransition(existing.status, "archived");
  const now = resolveNow(ports, ctx);
  const saved = await ports.videos.save(markVideoArchived(existing, now), {
    expectedRevision,
  });
  await audit(ports, ctx, "content.archived", saved.id);
  return saved;
}

export async function getVideo(ports: ContentPorts, videoId: string) {
  const video = await ports.videos.getById(videoId);
  if (!video) throw new NotFoundError("Video not found", { videoId });
  return video;
}

export async function listVideos(
  ports: ContentPorts,
  filter?: ContentListFilter,
  pagination?: PaginationInput,
) {
  return ports.videos.list(filter, pagination);
}
