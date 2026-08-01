import { createAuditEvent } from "@/domain/content/audit";
import {
  assertNoCategoryCycle,
  assertUniqueTagTitle,
  createAudience,
  createCategory,
  createTag,
  moveCategory,
  withAudienceUpdate,
  withCategoryUpdate,
  withTagUpdate,
} from "@/domain/content/taxonomy";
import { DuplicateSlugError, NotFoundError } from "@/domain/shared/errors";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type { ContentPorts, UseCaseContext } from "./ports";

function resolveNow(ports: ContentPorts, ctx: UseCaseContext): IsoDateTime {
  return (ctx.now as IsoDateTime | undefined) ?? ports.clock.now();
}

export async function createCategoryUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: Omit<Parameters<typeof createCategory>[0], "id" | "now"> & {
    id?: string;
  },
) {
  const now = resolveNow(ports, ctx);
  const id = input.id ?? ports.ids.next("category");
  if (await ports.categories.existsBySlug(input.slug)) {
    throw new DuplicateSlugError("Category slug already exists", {
      slug: input.slug,
    });
  }
  const all = await ports.categories.listAll();
  const category = createCategory({ ...input, id, now });
  if (category.parentId) {
    assertNoCategoryCycle(all, category.id, category.parentId);
  }
  const saved = await ports.categories.save(category, { expectedRevision: 0 });
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.created",
      entityType: "category",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId },
    }),
  );
  return saved;
}

export async function updateCategory(
  ports: ContentPorts,
  ctx: UseCaseContext,
  categoryId: string,
  expectedRevision: number,
  patch: Parameters<typeof withCategoryUpdate>[1],
) {
  const existing = await ports.categories.getById(categoryId);
  if (!existing) {
    throw new NotFoundError("Category not found", { categoryId });
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.categories.existsBySlug(patch.slug, categoryId)) {
      throw new DuplicateSlugError("Category slug already exists", {
        slug: patch.slug,
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const saved = await ports.categories.save(
    withCategoryUpdate(existing, patch, now),
    { expectedRevision },
  );
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.updated",
      entityType: "category",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId },
    }),
  );
  return saved;
}

export async function moveCategoryUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  categoryId: string,
  expectedRevision: number,
  newParentId: string | null,
) {
  const existing = await ports.categories.getById(categoryId);
  if (!existing) {
    throw new NotFoundError("Category not found", { categoryId });
  }
  const all = await ports.categories.listAll();
  const now = resolveNow(ports, ctx);
  const moved = moveCategory(existing, newParentId, all, now);
  const saved = await ports.categories.save(moved, { expectedRevision });
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.updated",
      entityType: "category",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId, change: "move" },
    }),
  );
  return saved;
}

export async function createTagUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: Omit<Parameters<typeof createTag>[0], "id" | "now"> & {
    id?: string;
  },
) {
  const now = resolveNow(ports, ctx);
  const id = input.id ?? ports.ids.next("tag");
  if (await ports.tags.existsBySlug(input.slug)) {
    throw new DuplicateSlugError("Tag slug already exists", {
      slug: input.slug,
    });
  }
  const all = await ports.tags.listAll();
  assertUniqueTagTitle(all, input.title);
  const tag = createTag({ ...input, id, now });
  const saved = await ports.tags.save(tag, { expectedRevision: 0 });
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.created",
      entityType: "tag",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId },
    }),
  );
  return saved;
}

export async function updateTag(
  ports: ContentPorts,
  ctx: UseCaseContext,
  tagId: string,
  expectedRevision: number,
  patch: Parameters<typeof withTagUpdate>[1],
) {
  const existing = await ports.tags.getById(tagId);
  if (!existing) throw new NotFoundError("Tag not found", { tagId });
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.tags.existsBySlug(patch.slug, tagId)) {
      throw new DuplicateSlugError("Tag slug already exists", {
        slug: patch.slug,
      });
    }
  }
  if (patch.title) {
    const all = await ports.tags.listAll();
    assertUniqueTagTitle(all, patch.title, existing.id);
  }
  const now = resolveNow(ports, ctx);
  const saved = await ports.tags.save(withTagUpdate(existing, patch, now), {
    expectedRevision,
  });
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.updated",
      entityType: "tag",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId },
    }),
  );
  return saved;
}

export async function createAudienceUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: Omit<Parameters<typeof createAudience>[0], "id" | "now"> & {
    id?: string;
  },
) {
  const now = resolveNow(ports, ctx);
  const id = input.id ?? ports.ids.next("audience");
  if (await ports.audiences.existsBySlug(input.slug)) {
    throw new DuplicateSlugError("Audience slug already exists", {
      slug: input.slug,
    });
  }
  const audience = createAudience({ ...input, id, now });
  const saved = await ports.audiences.save(audience, { expectedRevision: 0 });
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.created",
      entityType: "audience",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId },
    }),
  );
  return saved;
}

export async function updateAudience(
  ports: ContentPorts,
  ctx: UseCaseContext,
  audienceId: string,
  expectedRevision: number,
  patch: Parameters<typeof withAudienceUpdate>[1],
) {
  const existing = await ports.audiences.getById(audienceId);
  if (!existing) {
    throw new NotFoundError("Audience not found", { audienceId });
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.audiences.existsBySlug(patch.slug, audienceId)) {
      throw new DuplicateSlugError("Audience slug already exists", {
        slug: patch.slug,
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const saved = await ports.audiences.save(
    withAudienceUpdate(existing, patch, now),
    { expectedRevision },
  );
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType: "taxonomy.updated",
      entityType: "audience",
      entityId: saved.id,
      actorId: ctx.actorId,
      occurredAt: now,
      metadata: { requestId: ctx.requestId },
    }),
  );
  return saved;
}
