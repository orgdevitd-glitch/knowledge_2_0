import { createAuditEvent } from "@/domain/content/audit";
import {
  applyPromptVersionSnapshot,
  assertPromptPublishable,
  createPrompt,
  markPromptArchived,
  markPromptHidden,
  markPromptPublished,
  toPromptSnapshot,
  withPromptUpdate,
  type Prompt,
  type PromptSnapshot,
} from "@/domain/content/prompt";
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
      entityType: "prompt",
      entityId,
      actorId: ctx.actorId,
      occurredAt: resolveNow(ports, ctx),
      metadata: { requestId: ctx.requestId, ...metadata },
    }),
  );
}

export async function createPromptUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: Omit<Parameters<typeof createPrompt>[0], "id" | "now"> & {
    id?: string;
  },
): Promise<Prompt> {
  const now = resolveNow(ports, ctx);
  const id = input.id ?? ports.ids.next("prompt");
  if (await ports.prompts.existsBySlug(input.slug)) {
    throw new DuplicateSlugError("Prompt slug already exists", {
      slug: input.slug,
    });
  }
  const prompt = createPrompt({ ...input, id, now });
  const saved = await ports.prompts.save(prompt, { expectedRevision: 0 });
  await audit(ports, ctx, "content.created", saved.id);
  return saved;
}

export async function updatePrompt(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
  patch: Parameters<typeof withPromptUpdate>[1],
): Promise<Prompt> {
  const existing = await ports.prompts.getById(promptId);
  if (!existing) {
    throw new NotFoundError("Prompt not found", { promptId });
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.prompts.existsBySlug(patch.slug, promptId)) {
      throw new DuplicateSlugError("Prompt slug already exists", {
        slug: patch.slug,
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const saved = await ports.prompts.save(
    withPromptUpdate(existing, patch, now),
    { expectedRevision },
  );
  await audit(ports, ctx, "content.updated", saved.id);
  return saved;
}

export async function publishPrompt(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
  changeSummary?: string,
): Promise<{ prompt: Prompt; versionId: string }> {
  return ports.uow.run(async () => {
    const existing = await ports.prompts.getById(promptId);
    if (!existing) {
      throw new NotFoundError("Prompt not found", { promptId });
    }
    if (existing.status === "published") {
      // Republish while remaining published.
    } else {
      assertStatusTransition(existing.status, "published");
    }
    assertPromptPublishable(existing);
    const now = resolveNow(ports, ctx);
    const latest = await ports.versions.getLatestByEntity("prompt", promptId);
    const versionNumber = nextVersionNumber(
      latest ? latest.versionNumber : null,
    );
    const version = createContentVersion({
      id: ports.ids.next("version"),
      entityType: "prompt",
      entityId: promptId,
      versionNumber,
      snapshot: toPromptSnapshot(existing) as unknown as Record<
        string,
        unknown
      >,
      changeSummary: changeSummary ?? null,
      createdBy: ctx.actorId,
      createdAt: now,
    });
    await ports.versions.saveImmutable(version);
    const published = markPromptPublished(existing, version.id, now);
    const saved = await ports.prompts.save(published, { expectedRevision });
    await audit(ports, ctx, "content.published", saved.id, {
      versionId: version.id,
      versionNumber,
    });
    return { prompt: saved, versionId: version.id };
  });
}

export async function hidePrompt(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
): Promise<Prompt> {
  const existing = await ports.prompts.getById(promptId);
  if (!existing) throw new NotFoundError("Prompt not found", { promptId });
  assertStatusTransition(existing.status, "hidden");
  const now = resolveNow(ports, ctx);
  const saved = await ports.prompts.save(markPromptHidden(existing, now), {
    expectedRevision,
  });
  await audit(ports, ctx, "content.hidden", saved.id);
  return saved;
}

export async function archivePrompt(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
): Promise<Prompt> {
  const existing = await ports.prompts.getById(promptId);
  if (!existing) throw new NotFoundError("Prompt not found", { promptId });
  assertStatusTransition(existing.status, "archived");
  const now = resolveNow(ports, ctx);
  const saved = await ports.prompts.save(markPromptArchived(existing, now), {
    expectedRevision,
  });
  await audit(ports, ctx, "content.archived", saved.id);
  return saved;
}

export async function restorePromptVersion(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  versionId: string,
  expectedRevision: number,
): Promise<Prompt> {
  const existing = await ports.prompts.getById(promptId);
  if (!existing) throw new NotFoundError("Prompt not found", { promptId });
  const version = await ports.versions.getById(versionId);
  if (
    !version ||
    version.entityType !== "prompt" ||
    version.entityId !== promptId
  ) {
    throw new NotFoundError("Version not found for prompt", {
      promptId,
      versionId,
    });
  }
  const now = resolveNow(ports, ctx);
  const restored = applyPromptVersionSnapshot(
    existing,
    version.snapshot as unknown as PromptSnapshot,
    now,
  );
  const saved = await ports.prompts.save(restored, { expectedRevision });
  await audit(ports, ctx, "version.restored", saved.id, { versionId });
  return saved;
}

export async function getPrompt(ports: ContentPorts, promptId: string) {
  const prompt = await ports.prompts.getById(promptId);
  if (!prompt) throw new NotFoundError("Prompt not found", { promptId });
  return prompt;
}

export async function listPrompts(
  ports: ContentPorts,
  filter?: ContentListFilter,
  pagination?: PaginationInput,
) {
  return ports.prompts.list(filter, pagination);
}
