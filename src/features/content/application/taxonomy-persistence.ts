import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import type { AuditEventType } from "@/domain/content/audit";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type {
  AtomicTaxonomyEntityWrite,
} from "@/server/repositories/interfaces/unit-of-work";
import type { ContentPorts, UseCaseContext } from "./ports";

/**
 * Persist taxonomy write(s) and exactly one AuditEvent together.
 * Prefers UnitOfWork.runAtomicTaxonomyMutation when available.
 */
export async function persistTaxonomyMutation(
  ports: ContentPorts,
  ctx: UseCaseContext,
  writes: AtomicTaxonomyEntityWrite[],
  audit: {
    eventType: AuditEventType;
    entityType: "category" | "tag" | "audience";
    entityId: string;
    occurredAt: IsoDateTime;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const event = createAuditEvent({
    id: ports.ids.next("audit"),
    eventType: audit.eventType,
    entityType: audit.entityType,
    entityId: audit.entityId,
    actorId: ctx.actorId,
    occurredAt: audit.occurredAt,
    metadata: { requestId: ctx.requestId, ...audit.metadata },
  });

  if (ports.uow.runAtomicTaxonomyMutation) {
    await ports.uow.runAtomicTaxonomyMutation({ writes, audit: event });
    return;
  }

  await ports.uow.run(async () => {
    for (const write of writes) {
      if (write.kind === "category") {
        await ports.categories.save(write.entity as Category, {
          expectedRevision: write.expectedRevision,
        });
      } else if (write.kind === "tag") {
        await ports.tags.save(write.entity as Tag, {
          expectedRevision: write.expectedRevision,
        });
      } else {
        await ports.audiences.save(write.entity as Audience, {
          expectedRevision: write.expectedRevision,
        });
      }
    }
    await ports.audit.append(event);
  });
}
