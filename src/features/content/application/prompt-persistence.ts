import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import type { AuditEventType } from "@/domain/content/audit";
import type { Prompt } from "@/domain/content/prompt";
import type { ContentVersion } from "@/domain/content/versioning";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type { ContentPorts, UseCaseContext } from "./ports";

/**
 * Persist Prompt (+ optional ContentVersion) and AuditEvent atomically.
 */
export async function persistPromptMutation(
  ports: ContentPorts,
  ctx: UseCaseContext,
  prompt: Prompt,
  expectedRevision: number,
  audit: {
    eventType: AuditEventType;
    occurredAt: IsoDateTime;
    metadata?: Record<string, unknown>;
  },
  version?: ContentVersion,
): Promise<Prompt> {
  const event = createAuditEvent({
    id: ports.ids.next("audit"),
    eventType: audit.eventType,
    entityType: "prompt",
    entityId: prompt.id,
    actorId: ctx.actorId,
    occurredAt: audit.occurredAt,
    metadata: { requestId: ctx.requestId, ...audit.metadata },
  });

  if (ports.uow.runAtomicPromptMutation) {
    await ports.uow.runAtomicPromptMutation({
      prompt,
      expectedRevision,
      audit: event,
      version,
    });
    return prompt;
  }

  if (version && ports.uow.runAtomicPromptPublish) {
    await ports.uow.runAtomicPromptPublish({
      prompt,
      expectedRevision,
      version,
      audit: event,
    });
    return prompt;
  }

  // Fallback: sequential inside uow.run (no true rollback).
  return ports.uow.run(async () => {
    if (version) {
      await ports.versions.saveImmutable(version);
    }
    const saved = await ports.prompts.save(prompt, { expectedRevision });
    await ports.audit.append(event);
    return saved;
  });
}
