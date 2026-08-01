import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import {
  isImportJobExpired,
  parseImportJob,
  type ImportJob,
} from "@/domain/integrations/import-job";
import { NotFoundError } from "@/domain/shared/errors";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";

import type { IntegrationPorts } from "./ports";

export async function cancelImportJob(
  ports: IntegrationPorts,
  input: { actorId: string; requestId: string; importJobId: string },
): Promise<ImportJob> {
  const existing = await ports.importJobs.getById(input.importJobId);
  if (!existing) {
    throw new NotFoundError("Import job not found", {
      importJobId: input.importJobId,
    });
  }
  if (existing.status === "confirmed") {
    throw new GoogleWorkspaceError(
      "IMPORT_ALREADY_CONFIRMED",
      "Confirmed import cannot be cancelled",
    );
  }
  if (existing.status === "cancelled") {
    return existing;
  }
  if (isImportJobExpired(existing)) {
    throw new GoogleWorkspaceError(
      "IMPORT_PREVIEW_EXPIRED",
      "Import preview has expired",
    );
  }

  const now = ports.content.clock.now();
  const cancelled = parseImportJob({
    ...existing,
    status: "cancelled",
    preview: null,
  });
  const saved = await ports.importJobs.save(cancelled);
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.import.cancelled",
      entityType: "import-job",
      entityId: saved.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: { requestId: input.requestId },
    }),
  );
  return saved;
}
