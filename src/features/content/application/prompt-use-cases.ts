import {
  applyPromptVersionSnapshot,
  assertPromptPublishable,
  createPrompt,
  markPromptArchived,
  markPromptHidden,
  markPromptPublished,
  markPromptRestoredFromArchive,
  toPromptSnapshot,
  withPromptUpdate,
  type Prompt,
  type PromptSnapshot,
} from "@/domain/content/prompt";
import {
  createContentVersion,
  nextVersionNumber,
} from "@/domain/content/versioning";
import {
  DuplicateSlugError,
  NotFoundError,
  ValidationError,
} from "@/domain/shared/errors";
import { assertStatusTransition } from "@/domain/shared/status";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type {
  ContentListFilter,
  PaginationInput,
} from "@/server/repositories/interfaces/types";
import type { ContentPorts, UseCaseContext } from "./ports";
import { persistPromptMutation } from "./prompt-persistence";

function resolveNow(ports: ContentPorts, ctx: UseCaseContext): IsoDateTime {
  return (ctx.now as IsoDateTime | undefined) ?? ports.clock.now();
}

/**
 * Validate taxonomy IDs for prompt draft/publish.
 * Linked archived values may remain; newly added archived values are rejected.
 */
export async function assertPromptTaxonomyWritable(
  ports: ContentPorts,
  next: {
    categoryIds: readonly string[];
    tagIds: readonly string[];
    audienceIds: readonly string[];
  },
  previous?: {
    categoryIds: readonly string[];
    tagIds: readonly string[];
    audienceIds: readonly string[];
  },
): Promise<void> {
  const prevCats = new Set((previous?.categoryIds ?? []).map(String));
  const prevTags = new Set((previous?.tagIds ?? []).map(String));
  const prevAud = new Set((previous?.audienceIds ?? []).map(String));

  for (const id of next.categoryIds) {
    const entity = await ports.categories.getById(id);
    if (!entity) {
      throw new ValidationError("Category not found", {
        adminCode: "TAXONOMY_NOT_FOUND",
        taxonomyKind: "category",
        taxonomyId: id,
      });
    }
    if (entity.status === "archived" && !prevCats.has(String(id))) {
      throw new ValidationError("Cannot newly attach archived category", {
        adminCode: "TAXONOMY_ARCHIVED",
        taxonomyKind: "category",
        taxonomyId: id,
      });
    }
  }
  for (const id of next.tagIds) {
    const entity = await ports.tags.getById(id);
    if (!entity) {
      throw new ValidationError("Tag not found", {
        adminCode: "TAXONOMY_NOT_FOUND",
        taxonomyKind: "tag",
        taxonomyId: id,
      });
    }
    if (entity.status === "archived" && !prevTags.has(String(id))) {
      throw new ValidationError("Cannot newly attach archived tag", {
        adminCode: "TAXONOMY_ARCHIVED",
        taxonomyKind: "tag",
        taxonomyId: id,
      });
    }
  }
  for (const id of next.audienceIds) {
    const entity = await ports.audiences.getById(id);
    if (!entity) {
      throw new ValidationError("Audience not found", {
        adminCode: "TAXONOMY_NOT_FOUND",
        taxonomyKind: "audience",
        taxonomyId: id,
      });
    }
    if (entity.status === "archived" && !prevAud.has(String(id))) {
      throw new ValidationError("Cannot newly attach archived audience", {
        adminCode: "TAXONOMY_ARCHIVED",
        taxonomyKind: "audience",
        taxonomyId: id,
      });
    }
  }
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
  await assertPromptTaxonomyWritable(ports, {
    categoryIds: input.categoryIds ?? [],
    tagIds: input.tagIds ?? [],
    audienceIds: input.audienceIds ?? [],
  });
  const prompt = createPrompt({ ...input, id, now });
  return persistPromptMutation(
    ports,
    ctx,
    prompt,
    0,
    {
      eventType: "content.created",
      occurredAt: now,
      metadata: {
        sourceType: prompt.source.type,
        // Do not store full SourceReference / checksum / secrets.
        hasExternalId: Boolean(prompt.source.externalId),
      },
    },
  );
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
  if (existing.status === "archived") {
    throw new ValidationError("Archived prompt cannot be edited", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.prompts.existsBySlug(patch.slug, promptId)) {
      throw new DuplicateSlugError("Prompt slug already exists", {
        slug: patch.slug,
      });
    }
  }
  if (patch.source !== undefined) {
    const prev = existing.source;
    const next = patch.source;
    if (
      prev.type === "google-sheets" &&
      prev.externalId &&
      (next.type !== "google-sheets" ||
        next.externalId !== prev.externalId ||
        next.connectionId !== prev.connectionId)
    ) {
      throw new ValidationError(
        "Import-managed source externalId/connectionId cannot be changed",
        { adminCode: "SOURCE_REFERENCE_INVALID" },
      );
    }
  }
  const nextIds = {
    categoryIds: patch.categoryIds ?? existing.categoryIds,
    tagIds: patch.tagIds ?? existing.tagIds,
    audienceIds: patch.audienceIds ?? existing.audienceIds,
  };
  await assertPromptTaxonomyWritable(ports, nextIds, existing);
  const now = resolveNow(ports, ctx);
  const next = withPromptUpdate(existing, patch, now);
  return persistPromptMutation(ports, ctx, next, expectedRevision, {
    eventType: "content.updated",
    occurredAt: now,
    metadata: {
      fields: Object.keys(patch).filter((k) => k !== "source"),
      sourceType: next.source.type,
    },
  });
}

export async function publishPrompt(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
  changeSummary?: string,
): Promise<{ prompt: Prompt; versionId: string }> {
  const existing = await ports.prompts.getById(promptId);
  if (!existing) {
    throw new NotFoundError("Prompt not found", { promptId });
  }
  if (existing.status === "published") {
    // Republish while remaining published.
  } else {
    assertStatusTransition(existing.status, "published");
  }
  try {
    assertPromptPublishable(existing);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(error.message, {
        ...error.details,
        adminCode: "PUBLISH_VALIDATION_FAILED",
      });
    }
    throw error;
  }
  if (!existing.promptText.trim()) {
    throw new ValidationError("Prompt content is required", {
      adminCode: "PROMPT_CONTENT_REQUIRED",
    });
  }
  await assertPromptTaxonomyWritable(ports, existing, existing);

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
    snapshot: toPromptSnapshot(existing) as unknown as Record<string, unknown>,
    changeSummary: changeSummary ?? null,
    createdBy: ctx.actorId,
    createdAt: now,
  });
  // ContentVersion.source is portalSource() = creation reason for this version.
  const published = markPromptPublished(existing, version.id, now);
  const saved = await persistPromptMutation(
    ports,
    ctx,
    published,
    expectedRevision,
    {
      eventType: "content.published",
      occurredAt: now,
      metadata: {
        versionId: version.id,
        versionNumber,
        previousStatus: existing.status,
        nextStatus: "published",
        sourceType: published.source.type,
        hasExternalId: Boolean(published.source.externalId),
      },
    },
    version,
  );
  return { prompt: saved, versionId: version.id };
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
  const next = markPromptHidden(existing, now);
  return persistPromptMutation(ports, ctx, next, expectedRevision, {
    eventType: "content.hidden",
    occurredAt: now,
    metadata: {
      previousStatus: existing.status,
      nextStatus: "hidden",
      sourceType: next.source.type,
    },
  });
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
  const next = markPromptArchived(existing, now);
  return persistPromptMutation(ports, ctx, next, expectedRevision, {
    eventType: "content.archived",
    occurredAt: now,
    metadata: {
      previousStatus: existing.status,
      nextStatus: "archived",
      publishedVersion: next.publishedVersion,
      sourceType: next.source.type,
    },
  });
}

export async function restoreArchivedPrompt(
  ports: ContentPorts,
  ctx: UseCaseContext,
  promptId: string,
  expectedRevision: number,
): Promise<Prompt> {
  const existing = await ports.prompts.getById(promptId);
  if (!existing) throw new NotFoundError("Prompt not found", { promptId });
  assertStatusTransition(existing.status, "draft");
  const now = resolveNow(ports, ctx);
  const next = markPromptRestoredFromArchive(existing, now);
  return persistPromptMutation(ports, ctx, next, expectedRevision, {
    eventType: "content.restored",
    occurredAt: now,
    metadata: {
      previousStatus: existing.status,
      nextStatus: "draft",
      sourceType: next.source.type,
    },
  });
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
      adminCode: "VERSION_NOT_FOUND",
    });
  }
  const now = resolveNow(ports, ctx);
  let restored: Prompt;
  try {
    restored = applyPromptVersionSnapshot(
      existing,
      version.snapshot as unknown as PromptSnapshot,
      now,
    );
  } catch (error) {
    throw new ValidationError(
      error instanceof Error
        ? error.message
        : "Version snapshot is incompatible",
      { adminCode: "VERSION_INCOMPATIBLE", versionId },
    );
  }
  // Provenance policy: restore version does not replace entity SourceReference
  // with historical snapshot (PromptSnapshot has no source).
  await assertPromptTaxonomyWritable(ports, restored, existing);
  return persistPromptMutation(ports, ctx, restored, expectedRevision, {
    eventType: "version.restored",
    occurredAt: now,
    metadata: {
      versionId,
      previousStatus: existing.status,
      nextStatus: restored.status,
      sourceType: restored.source.type,
    },
  });
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
