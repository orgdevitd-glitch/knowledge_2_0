import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import { parseSourceConnection } from "@/domain/integrations/source-connection";
import { NotFoundError } from "@/domain/shared/errors";

import type { IntegrationPorts } from "./ports";

export async function archiveSourceConnection(
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
    return existing;
  }
  const now = ports.content.clock.now();
  const updated = parseSourceConnection({
    ...existing,
    status: "archived",
    updatedAt: now,
    revision: existing.revision + 1,
  });
  const saved = await ports.sources.save(updated, existing.revision);
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.source.archived",
      entityType: "source-connection",
      entityId: saved.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: { requestId: input.requestId },
    }),
  );
  return saved;
}
