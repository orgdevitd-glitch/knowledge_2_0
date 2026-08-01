import {
  archiveAudience,
  archiveCategory,
  archiveTag,
  assertCategoryHasNoActiveChildren,
  assertCategoryParentUsable,
  assertNoCategoryCycle,
  assertTaxonomyTreeSize,
  assertUniqueTagTitle,
  compareTaxonomyOrder,
  createAudience,
  createCategory,
  createTag,
  moveCategory,
  restoreAudience,
  restoreCategory,
  restoreTag,
  withAudienceUpdate,
  withCategoryUpdate,
  withTagUpdate,
  type Audience,
  type Category,
  type Tag,
} from "@/domain/content/taxonomy";
import {
  DuplicateSlugError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from "@/domain/shared/errors";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import { parseSortOrder } from "@/domain/shared/value-objects";
import type { AtomicTaxonomyEntityWrite } from "@/server/repositories/interfaces/unit-of-work";
import type { ContentPorts, UseCaseContext } from "./ports";
import { persistTaxonomyMutation } from "./taxonomy-persistence";

function resolveNow(ports: ContentPorts, ctx: UseCaseContext): IsoDateTime {
  return (ctx.now as IsoDateTime | undefined) ?? ports.clock.now();
}

async function loadCategories(ports: ContentPorts): Promise<Category[]> {
  const all = await ports.categories.listAll();
  assertTaxonomyTreeSize(all.length);
  return all;
}

async function loadTags(ports: ContentPorts): Promise<Tag[]> {
  const all = await ports.tags.listAll();
  assertTaxonomyTreeSize(all.length);
  return all;
}

async function loadAudiences(ports: ContentPorts): Promise<Audience[]> {
  const all = await ports.audiences.listAll();
  assertTaxonomyTreeSize(all.length);
  return all;
}

function sortOrderStep(siblings: Array<{ sortOrder: number }>): number {
  if (siblings.length === 0) return 0;
  const max = Math.max(...siblings.map((s) => s.sortOrder));
  return max + 10;
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
  const all = await loadCategories(ports);
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const parentKey = input.parentId ?? null;
    const siblings = all.filter((c) => c.parentId === parentKey);
    sortOrder = sortOrderStep(siblings);
  }
  const category = createCategory({ ...input, id, now, sortOrder });
  assertCategoryParentUsable(all, category.parentId);
  if (category.parentId) {
    assertNoCategoryCycle(all, category.id, category.parentId);
  }
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "category", entity: category, expectedRevision: 0 }],
    {
      eventType: "taxonomy.category.created",
      entityType: "category",
      entityId: category.id,
      occurredAt: now,
      metadata: { slug: category.slug, parentId: category.parentId },
    },
  );
  return category;
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
  if (patch.status && patch.status !== existing.status) {
    throw new ValidationError(
      "Use archive/restore endpoints to change taxonomy status",
      { adminCode: "INVALID_STATUS_TRANSITION" },
    );
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.categories.existsBySlug(patch.slug, categoryId)) {
      throw new DuplicateSlugError("Category slug already exists", {
        slug: patch.slug,
      });
    }
  }
  if (patch.sortOrder !== undefined) {
    try {
      parseSortOrder(patch.sortOrder);
    } catch {
      throw new ValidationError("Invalid sort order", {
        adminCode: "INVALID_SORT_ORDER",
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const previousSlug = existing.slug;
  const next = withCategoryUpdate(existing, patch, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "category", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.category.updated",
      entityType: "category",
      entityId: next.id,
      occurredAt: now,
      metadata: {
        previousSlug,
        nextSlug: next.slug,
        previousSortOrder: existing.sortOrder,
        nextSortOrder: next.sortOrder,
      },
    },
  );
  return next;
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
  const all = await loadCategories(ports);
  if (newParentId) {
    const parent = all.find((c) => c.id === newParentId);
    assertCategoryParentUsable(all, parent ? parent.id : null);
    if (!parent) {
      throw new ValidationError("Category parent does not exist", {
        adminCode: "INVALID_PARENT",
        parentId: newParentId,
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const previousParentId = existing.parentId;
  const moved = moveCategory(existing, newParentId, all, now);
  const siblings = all.filter(
    (c) => c.parentId === moved.parentId && c.id !== moved.id,
  );
  const withOrder = {
    ...moved,
    sortOrder: parseSortOrder(sortOrderStep(siblings)),
  };
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "category", entity: withOrder, expectedRevision }],
    {
      eventType: "taxonomy.category.moved",
      entityType: "category",
      entityId: withOrder.id,
      occurredAt: now,
      metadata: {
        previousParentId,
        nextParentId: withOrder.parentId,
      },
    },
  );
  return withOrder;
}

export async function reorderCategoryUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  categoryId: string,
  expectedRevision: number,
  direction: "up" | "down" | "position",
  position?: number,
) {
  const existing = await ports.categories.getById(categoryId);
  if (!existing) {
    throw new NotFoundError("Category not found", { categoryId });
  }
  const all = await loadCategories(ports);
  const siblings = all
    .filter((c) => c.parentId === existing.parentId)
    .sort(compareTaxonomyOrder);
  const index = siblings.findIndex((c) => c.id === existing.id);
  if (index < 0) {
    throw new ValidationError("Category not found among siblings", {
      adminCode: "VALIDATION_ERROR",
    });
  }

  let targetIndex = index;
  if (direction === "up") targetIndex = Math.max(0, index - 1);
  else if (direction === "down") {
    targetIndex = Math.min(siblings.length - 1, index + 1);
  } else {
    if (position === undefined || !Number.isInteger(position) || position < 0) {
      throw new ValidationError("Invalid sort position", {
        adminCode: "INVALID_SORT_ORDER",
      });
    }
    targetIndex = Math.min(siblings.length - 1, position);
  }

  if (targetIndex === index) {
    return existing;
  }

  const reordered = [...siblings];
  const [item] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, item!);

  const now = resolveNow(ports, ctx);
  const previousSortOrder = existing.sortOrder;
  const writes: AtomicTaxonomyEntityWrite[] = [];
  let savedCurrent = existing;
  for (let i = 0; i < reordered.length; i += 1) {
    const sibling = reordered[i]!;
    const nextOrder = i * 10;
    if (sibling.sortOrder === nextOrder && sibling.id !== existing.id) {
      continue;
    }
    const expected =
      sibling.id === existing.id ? expectedRevision : sibling.revision;
    const updated = withCategoryUpdate(
      sibling,
      { sortOrder: nextOrder },
      now,
    );
    writes.push({
      kind: "category",
      entity: updated,
      expectedRevision: expected,
    });
    if (updated.id === existing.id) savedCurrent = updated;
  }

  if (writes.length > 0) {
    await persistTaxonomyMutation(ports, ctx, writes, {
      eventType: "taxonomy.category.reordered",
      entityType: "category",
      entityId: savedCurrent.id,
      occurredAt: now,
      metadata: {
        previousSortOrder,
        nextSortOrder: savedCurrent.sortOrder,
        direction,
      },
    });
  }
  return savedCurrent;
}

export async function archiveCategoryUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  categoryId: string,
  expectedRevision: number,
) {
  const existing = await ports.categories.getById(categoryId);
  if (!existing) {
    throw new NotFoundError("Category not found", { categoryId });
  }
  if (existing.status === "archived") {
    throw new InvalidStatusTransitionError("Category is already archived");
  }
  const all = await loadCategories(ports);
  assertCategoryHasNoActiveChildren(all, existing.id);
  const now = resolveNow(ports, ctx);
  const next = archiveCategory(existing, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "category", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.category.archived",
      entityType: "category",
      entityId: next.id,
      occurredAt: now,
    },
  );
  return next;
}

export async function restoreCategoryUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  categoryId: string,
  expectedRevision: number,
) {
  const existing = await ports.categories.getById(categoryId);
  if (!existing) {
    throw new NotFoundError("Category not found", { categoryId });
  }
  if (existing.status === "active") {
    throw new InvalidStatusTransitionError("Category is already active");
  }
  if (existing.parentId) {
    const all = await loadCategories(ports);
    assertCategoryParentUsable(all, existing.parentId);
  }
  const now = resolveNow(ports, ctx);
  const next = restoreCategory(existing, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "category", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.category.restored",
      entityType: "category",
      entityId: next.id,
      occurredAt: now,
    },
  );
  return next;
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
  const all = await loadTags(ports);
  assertUniqueTagTitle(all, input.title);
  const tag = createTag({ ...input, id, now });
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "tag", entity: tag, expectedRevision: 0 }],
    {
      eventType: "taxonomy.tag.created",
      entityType: "tag",
      entityId: tag.id,
      occurredAt: now,
      metadata: { slug: tag.slug },
    },
  );
  return tag;
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
  if (patch.status && patch.status !== existing.status) {
    throw new ValidationError(
      "Use archive/restore endpoints to change taxonomy status",
      { adminCode: "INVALID_STATUS_TRANSITION" },
    );
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.tags.existsBySlug(patch.slug, tagId)) {
      throw new DuplicateSlugError("Tag slug already exists", {
        slug: patch.slug,
      });
    }
  }
  if (patch.title) {
    const all = await loadTags(ports);
    assertUniqueTagTitle(all, patch.title, existing.id);
  }
  const now = resolveNow(ports, ctx);
  const previousSlug = existing.slug;
  const next = withTagUpdate(existing, patch, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "tag", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.tag.updated",
      entityType: "tag",
      entityId: next.id,
      occurredAt: now,
      metadata: { previousSlug, nextSlug: next.slug },
    },
  );
  return next;
}

export async function archiveTagUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  tagId: string,
  expectedRevision: number,
) {
  const existing = await ports.tags.getById(tagId);
  if (!existing) throw new NotFoundError("Tag not found", { tagId });
  if (existing.status === "archived") {
    throw new InvalidStatusTransitionError("Tag is already archived");
  }
  const now = resolveNow(ports, ctx);
  const next = archiveTag(existing, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "tag", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.tag.archived",
      entityType: "tag",
      entityId: next.id,
      occurredAt: now,
    },
  );
  return next;
}

export async function restoreTagUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  tagId: string,
  expectedRevision: number,
) {
  const existing = await ports.tags.getById(tagId);
  if (!existing) throw new NotFoundError("Tag not found", { tagId });
  if (existing.status === "active") {
    throw new InvalidStatusTransitionError("Tag is already active");
  }
  const now = resolveNow(ports, ctx);
  const next = restoreTag(existing, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "tag", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.tag.restored",
      entityType: "tag",
      entityId: next.id,
      occurredAt: now,
    },
  );
  return next;
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
  const all = await loadAudiences(ports);
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    sortOrder = sortOrderStep(all);
  }
  const audience = createAudience({ ...input, id, now, sortOrder });
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "audience", entity: audience, expectedRevision: 0 }],
    {
      eventType: "taxonomy.audience.created",
      entityType: "audience",
      entityId: audience.id,
      occurredAt: now,
      metadata: { slug: audience.slug },
    },
  );
  return audience;
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
  if (patch.status && patch.status !== existing.status) {
    throw new ValidationError(
      "Use archive/restore endpoints to change taxonomy status",
      { adminCode: "INVALID_STATUS_TRANSITION" },
    );
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.audiences.existsBySlug(patch.slug, audienceId)) {
      throw new DuplicateSlugError("Audience slug already exists", {
        slug: patch.slug,
      });
    }
  }
  if (patch.sortOrder !== undefined) {
    try {
      parseSortOrder(patch.sortOrder);
    } catch {
      throw new ValidationError("Invalid sort order", {
        adminCode: "INVALID_SORT_ORDER",
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const previousSlug = existing.slug;
  const previousSortOrder = existing.sortOrder;
  const next = withAudienceUpdate(existing, patch, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "audience", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.audience.updated",
      entityType: "audience",
      entityId: next.id,
      occurredAt: now,
      metadata: {
        previousSlug,
        nextSlug: next.slug,
        previousSortOrder,
        nextSortOrder: next.sortOrder,
      },
    },
  );
  return next;
}

export async function reorderAudienceUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  audienceId: string,
  expectedRevision: number,
  direction: "up" | "down" | "position",
  position?: number,
) {
  const existing = await ports.audiences.getById(audienceId);
  if (!existing) {
    throw new NotFoundError("Audience not found", { audienceId });
  }
  const all = (await loadAudiences(ports)).sort(compareTaxonomyOrder);
  const index = all.findIndex((a) => a.id === existing.id);
  if (index < 0) {
    throw new ValidationError("Audience not found in list", {
      adminCode: "VALIDATION_ERROR",
    });
  }

  let targetIndex = index;
  if (direction === "up") targetIndex = Math.max(0, index - 1);
  else if (direction === "down") {
    targetIndex = Math.min(all.length - 1, index + 1);
  } else {
    if (position === undefined || !Number.isInteger(position) || position < 0) {
      throw new ValidationError("Invalid sort position", {
        adminCode: "INVALID_SORT_ORDER",
      });
    }
    targetIndex = Math.min(all.length - 1, position);
  }
  if (targetIndex === index) return existing;

  const reordered = [...all];
  const [item] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, item!);

  const now = resolveNow(ports, ctx);
  const previousSortOrder = existing.sortOrder;
  const writes: AtomicTaxonomyEntityWrite[] = [];
  let savedCurrent = existing;
  for (let i = 0; i < reordered.length; i += 1) {
    const audience = reordered[i]!;
    const nextOrder = i * 10;
    if (audience.sortOrder === nextOrder && audience.id !== existing.id) {
      continue;
    }
    const expected =
      audience.id === existing.id ? expectedRevision : audience.revision;
    const updated = withAudienceUpdate(
      audience,
      { sortOrder: nextOrder },
      now,
    );
    writes.push({
      kind: "audience",
      entity: updated,
      expectedRevision: expected,
    });
    if (updated.id === existing.id) savedCurrent = updated;
  }

  if (writes.length > 0) {
    await persistTaxonomyMutation(ports, ctx, writes, {
      eventType: "taxonomy.audience.reordered",
      entityType: "audience",
      entityId: savedCurrent.id,
      occurredAt: now,
      metadata: {
        previousSortOrder,
        nextSortOrder: savedCurrent.sortOrder,
        direction,
      },
    });
  }
  return savedCurrent;
}

export async function archiveAudienceUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  audienceId: string,
  expectedRevision: number,
) {
  const existing = await ports.audiences.getById(audienceId);
  if (!existing) {
    throw new NotFoundError("Audience not found", { audienceId });
  }
  if (existing.status === "archived") {
    throw new InvalidStatusTransitionError("Audience is already archived");
  }
  const now = resolveNow(ports, ctx);
  const next = archiveAudience(existing, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "audience", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.audience.archived",
      entityType: "audience",
      entityId: next.id,
      occurredAt: now,
    },
  );
  return next;
}

export async function restoreAudienceUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  audienceId: string,
  expectedRevision: number,
) {
  const existing = await ports.audiences.getById(audienceId);
  if (!existing) {
    throw new NotFoundError("Audience not found", { audienceId });
  }
  if (existing.status === "active") {
    throw new InvalidStatusTransitionError("Audience is already active");
  }
  const now = resolveNow(ports, ctx);
  const next = restoreAudience(existing, now);
  await persistTaxonomyMutation(
    ports,
    ctx,
    [{ kind: "audience", entity: next, expectedRevision }],
    {
      eventType: "taxonomy.audience.restored",
      entityType: "audience",
      entityId: next.id,
      occurredAt: now,
    },
  );
  return next;
}

export function buildCategoryTree(categories: readonly Category[]) {
  assertTaxonomyTreeSize(categories.length);
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parentId;
    const list = byParent.get(key) ?? [];
    list.push(category);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort(compareTaxonomyOrder);
  }

  type Node = Category & { depth: number; children: Node[]; childCount: number };
  function walk(parentId: string | null, depth: number): Node[] {
    if (depth > CONTENT_LIMITS.categoryTreeDepth) {
      throw new ValidationError("Category tree depth limit exceeded", {
        adminCode: "CATEGORY_DEPTH_EXCEEDED",
        maxDepth: CONTENT_LIMITS.categoryTreeDepth,
      });
    }
    const children = byParent.get(parentId) ?? [];
    return children.map((c) => {
      const nested = walk(c.id, depth + 1);
      return {
        ...c,
        depth,
        children: nested,
        childCount: nested.length,
      };
    });
  }

  const ids = new Set(categories.map((c) => c.id as string));
  for (const category of categories) {
    if (category.parentId && !ids.has(category.parentId)) {
      throw new ValidationError("Category tree integrity error", {
        adminCode: "INVALID_PARENT",
        categoryId: category.id,
        parentId: category.parentId,
      });
    }
  }

  return walk(null, 0);
}

export {
  compareTaxonomyOrder,
};
