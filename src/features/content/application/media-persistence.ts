import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import type { AuditEvent, AuditEventType } from "@/domain/content/audit";
import type { MediaAsset } from "@/domain/content/media";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type { ContentPorts, UseCaseContext } from "./ports";

export type MediaAuditSpec = {
  eventType: AuditEventType;
  occurredAt: IsoDateTime;
  metadata?: Record<string, unknown>;
};

function buildAudits(
  ports: ContentPorts,
  ctx: UseCaseContext,
  media: MediaAsset,
  specs: MediaAuditSpec[],
): AuditEvent[] {
  return specs.map((audit) =>
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: audit.eventType,
      entityType: "media",
      entityId: media.id,
      actorId: ctx.actorId,
      occurredAt: audit.occurredAt,
      metadata: { requestId: ctx.requestId, ...audit.metadata },
    }),
  );
}

/**
 * Persist MediaAsset + one or more AuditEvents atomically.
 */
export async function persistMediaMutation(
  ports: ContentPorts,
  ctx: UseCaseContext,
  media: MediaAsset,
  expectedRevision: number,
  audit: MediaAuditSpec | MediaAuditSpec[],
): Promise<MediaAsset> {
  const specs = Array.isArray(audit) ? audit : [audit];
  const audits = buildAudits(ports, ctx, media, specs);

  if (!ports.media) {
    throw new Error("Media repository is not configured");
  }

  if (ports.uow.runAtomicMediaMutation) {
    await ports.uow.runAtomicMediaMutation({
      media,
      expectedRevision,
      audits,
    });
    return media;
  }

  return ports.uow.run(async () => {
    const saved = await ports.media!.save(media, { expectedRevision });
    for (const event of audits) {
      await ports.audit.append(event);
    }
    return saved;
  });
}
