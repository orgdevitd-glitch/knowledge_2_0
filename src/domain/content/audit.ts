import { ValidationError } from "../shared/errors";
import type { AuditEventId, UserId } from "../shared/ids";
import {
  AuditEventId as AuditEventIdP,
  UserId as UserIdP,
} from "../shared/ids";
import { CONTENT_LIMITS } from "../shared/limits";
import type { IsoDateTime } from "../shared/value-objects";

export const AUDIT_EVENT_TYPES = [
  "content.created",
  "content.updated",
  "content.published",
  "content.hidden",
  "content.archived",
  "content.restored",
  "version.restored",
  "taxonomy.created",
  "taxonomy.updated",
  "taxonomy.category.created",
  "taxonomy.category.updated",
  "taxonomy.category.moved",
  "taxonomy.category.reordered",
  "taxonomy.category.archived",
  "taxonomy.category.restored",
  "taxonomy.tag.created",
  "taxonomy.tag.updated",
  "taxonomy.tag.archived",
  "taxonomy.tag.restored",
  "taxonomy.audience.created",
  "taxonomy.audience.updated",
  "taxonomy.audience.reordered",
  "taxonomy.audience.archived",
  "taxonomy.audience.restored",
  "integration.source.created",
  "integration.source.tested",
  "integration.source.access_lost",
  "integration.source.archived",
  "integration.import.preview_created",
  "integration.import.confirmed",
  "integration.import.cancelled",
  "integration.import.failed",
  "article.imported",
  "prompt.batch_imported",
  "media.created",
  "media.upload.started",
  "media.upload.completed",
  "media.upload.failed",
  "media.metadata.updated",
  "media.archived",
  "media.restored",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditEntityType =
  | "article"
  | "prompt"
  | "video"
  | "category"
  | "tag"
  | "audience"
  | "version"
  | "source-connection"
  | "import-job"
  | "media";

export type AuditMetadata = Record<string, unknown>;

export type AuditEvent = {
  id: AuditEventId;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  actorId: UserId;
  occurredAt: IsoDateTime;
  metadata: AuditMetadata;
};

const FORBIDDEN_META_KEYS = new Set([
  "snapshot",
  "blocks",
  "promptText",
  "password",
  "token",
  "secret",
  "authorization",
  "storageKey",
  "signedUrl",
  "uploadUrl",
  "bucket",
  "credentials",
  "privateKey",
]);

export function sanitizeAuditMetadata(
  metadata: AuditMetadata | undefined,
): AuditMetadata {
  const input = metadata ?? {};
  const out: AuditMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_META_KEYS.has(key)) continue;
    if (typeof value === "function") continue;
    out[key] = value;
  }
  const serialized = JSON.stringify(out);
  if (serialized.length > CONTENT_LIMITS.auditMetadataBytes) {
    throw new ValidationError("Audit metadata exceeds size limit", {
      max: CONTENT_LIMITS.auditMetadataBytes,
      actual: serialized.length,
    });
  }
  return JSON.parse(serialized) as AuditMetadata;
}

export function createAuditEvent(input: {
  id: string;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  actorId: string;
  occurredAt: IsoDateTime;
  metadata?: AuditMetadata;
}): AuditEvent {
  return {
    id: AuditEventIdP.parse(input.id),
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: UserIdP.parse(input.actorId),
    occurredAt: input.occurredAt,
    metadata: sanitizeAuditMetadata(input.metadata),
  };
}
