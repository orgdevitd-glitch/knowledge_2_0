import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import { parseSourceConnection } from "@/domain/integrations/source-connection";
import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import { NotFoundError } from "@/domain/shared/errors";

import type { IntegrationPorts } from "./ports";

export async function testSourceConnection(
  ports: IntegrationPorts,
  input: { actorId: string; requestId: string; sourceId: string },
) {
  const existing = await ports.sources.getById(input.sourceId);
  if (!existing) {
    throw new NotFoundError("Source connection not found", {
      sourceId: input.sourceId,
    });
  }
  if (existing.status === "archived") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Archived source connection cannot be tested for import",
    );
  }

  const policy = new GoogleDriveBoundaryPolicy(ports.google.drive, ports.config);
  const now = ports.content.clock.now();

  try {
    const metadata = await policy.verifyFileForImport(existing.externalId);
    const updated = parseSourceConnection({
      ...existing,
      status: "active",
      displayName: metadata.name,
      mimeType: metadata.mimeType,
      lastKnownModifiedAt: metadata.modifiedTime,
      lastKnownVersion: metadata.version,
      updatedAt: now,
      revision: existing.revision + 1,
    });
    const saved = await ports.sources.save(updated, existing.revision);
    await ports.content.audit.append(
      createAuditEvent({
        id: ports.content.ids.next("audit"),
        eventType: "integration.source.tested",
        entityType: "source-connection",
        entityId: saved.id,
        actorId: input.actorId,
        occurredAt: now,
        metadata: { requestId: input.requestId, ok: true },
      }),
    );
    return { ok: true as const, connection: saved };
  } catch (error) {
    const updated = parseSourceConnection({
      ...existing,
      status: "access-lost",
      updatedAt: now,
      revision: existing.revision + 1,
    });
    const saved = await ports.sources.save(updated, existing.revision);
    await ports.content.audit.append(
      createAuditEvent({
        id: ports.content.ids.next("audit"),
        eventType: "integration.source.access_lost",
        entityType: "source-connection",
        entityId: saved.id,
        actorId: input.actorId,
        occurredAt: now,
        metadata: {
          requestId: input.requestId,
          code:
            error instanceof GoogleWorkspaceError
              ? error.code
              : "GOOGLE_ACCESS_DENIED",
        },
      }),
    );
    if (error instanceof GoogleWorkspaceError) throw error;
    throw new GoogleWorkspaceError(
      "GOOGLE_ACCESS_DENIED",
      "Source access lost",
    );
  }
}
