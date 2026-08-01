import { DuplicateTitleError, ValidationError } from "../shared/errors";
import type { AudienceId, CategoryId, TagId } from "../shared/ids";
import {
  AudienceId as AudienceIdP,
  CategoryId as CategoryIdP,
  TagId as TagIdP,
} from "../shared/ids";
import { CONTENT_LIMITS } from "../shared/limits";
import type { TaxonomyStatus } from "../shared/status";
import type {
  IsoDateTime,
  Revision,
  Slug,
  SortOrder,
  Title,
} from "../shared/value-objects";
import {
  initialRevision,
  nextRevision,
  normalizeTitleKey,
  parseSlug,
  parseSortOrder,
  parseTitle,
} from "../shared/value-objects";

export type Category = {
  id: CategoryId;
  slug: Slug;
  title: Title;
  description: string | null;
  parentId: CategoryId | null;
  sortOrder: SortOrder;
  status: TaxonomyStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  revision: Revision;
};

export type Tag = {
  id: TagId;
  slug: Slug;
  title: Title;
  description: string | null;
  status: TaxonomyStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  revision: Revision;
};

export type Audience = {
  id: AudienceId;
  slug: Slug;
  title: Title;
  description: string | null;
  sortOrder: SortOrder;
  status: TaxonomyStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  revision: Revision;
};

export function createCategory(input: {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  now: IsoDateTime;
}): Category {
  const id = CategoryIdP.parse(input.id);
  const parentId = input.parentId ? CategoryIdP.parse(input.parentId) : null;
  if (parentId && parentId === id) {
    throw new ValidationError("Category cannot be its own parent", {
      adminCode: "CATEGORY_CYCLE",
    });
  }
  return {
    id,
    slug: parseSlug(input.slug),
    title: parseTitle(input.title),
    description: input.description?.trim() || null,
    parentId,
    sortOrder: parseSortOrder(input.sortOrder ?? 0),
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
    revision: initialRevision(),
  };
}

/**
 * Detects cycles when setting parentId using existing categories map.
 */
export function assertNoCategoryCycle(
  categories: readonly Category[],
  categoryId: CategoryId,
  newParentId: CategoryId | null,
  maxDepth = CONTENT_LIMITS.categoryTreeDepth,
): void {
  if (!newParentId) return;
  if (newParentId === categoryId) {
    throw new ValidationError("Category cannot be its own parent", {
      adminCode: "CATEGORY_CYCLE",
    });
  }
  const byId = new Map(categories.map((c) => [c.id as string, c]));
  let current: string | null = newParentId;
  let depth = 0;
  const seen = new Set<string>([categoryId]);
  while (current) {
    if (seen.has(current)) {
      throw new ValidationError("Category tree cycle is not allowed", {
        adminCode: "CATEGORY_CYCLE",
      });
    }
    seen.add(current);
    depth += 1;
    if (depth > maxDepth) {
      throw new ValidationError("Category tree depth limit exceeded", {
        adminCode: "CATEGORY_DEPTH_EXCEEDED",
        maxDepth,
      });
    }
    const node = byId.get(current);
    if (!node) {
      throw new ValidationError("Category parent does not exist", {
        adminCode: "INVALID_PARENT",
        parentId: current,
      });
    }
    current = node.parentId;
  }
}

export function assertCategoryParentUsable(
  categories: readonly Category[],
  parentId: CategoryId | null,
): void {
  if (!parentId) return;
  const parent = categories.find((c) => c.id === parentId);
  if (!parent) {
    throw new ValidationError("Category parent does not exist", {
      adminCode: "INVALID_PARENT",
      parentId,
    });
  }
  if (parent.status === "archived") {
    throw new ValidationError("Archived category cannot be a parent", {
      adminCode: "CATEGORY_PARENT_ARCHIVED",
      parentId,
    });
  }
}

export function assertTaxonomyTreeSize(count: number): void {
  if (count > CONTENT_LIMITS.maxTaxonomyTreeItems) {
    throw new ValidationError("Taxonomy tree exceeds configured size limit", {
      adminCode: "TAXONOMY_TREE_LIMIT_EXCEEDED",
      max: CONTENT_LIMITS.maxTaxonomyTreeItems,
      actual: count,
    });
  }
}

/** Active children block archive (no cascade, no active orphans under archived parent). */
export function assertCategoryHasNoActiveChildren(
  categories: readonly Category[],
  categoryId: CategoryId,
): void {
  const activeChildren = categories.filter(
    (c) => c.parentId === categoryId && c.status === "active",
  );
  if (activeChildren.length > 0) {
    throw new ValidationError(
      "Category has active children; move or archive them first",
      {
        adminCode: "CATEGORY_HAS_ACTIVE_CHILDREN",
        childCount: activeChildren.length,
      },
    );
  }
}

export function archiveCategory(
  category: Category,
  now: IsoDateTime,
): Category {
  if (category.status === "archived") {
    throw new ValidationError("Category is already archived", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return withCategoryUpdate(category, { status: "archived" }, now);
}

export function restoreCategory(
  category: Category,
  now: IsoDateTime,
): Category {
  if (category.status === "active") {
    throw new ValidationError("Category is already active", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return withCategoryUpdate(category, { status: "active" }, now);
}

export function archiveTag(tag: Tag, now: IsoDateTime): Tag {
  if (tag.status === "archived") {
    throw new ValidationError("Tag is already archived", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return withTagUpdate(tag, { status: "archived" }, now);
}

export function restoreTag(tag: Tag, now: IsoDateTime): Tag {
  if (tag.status === "active") {
    throw new ValidationError("Tag is already active", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return withTagUpdate(tag, { status: "active" }, now);
}

export function archiveAudience(
  audience: Audience,
  now: IsoDateTime,
): Audience {
  if (audience.status === "archived") {
    throw new ValidationError("Audience is already archived", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return withAudienceUpdate(audience, { status: "archived" }, now);
}

export function restoreAudience(
  audience: Audience,
  now: IsoDateTime,
): Audience {
  if (audience.status === "active") {
    throw new ValidationError("Audience is already active", {
      adminCode: "INVALID_STATUS_TRANSITION",
    });
  }
  return withAudienceUpdate(audience, { status: "active" }, now);
}

/** Deterministic sibling order: sortOrder asc, title asc, id asc. */
export function compareTaxonomyOrder(
  a: { sortOrder: number; title: string; id: string },
  b: { sortOrder: number; title: string; id: string },
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const byTitle = a.title.localeCompare(b.title, "ru");
  if (byTitle !== 0) return byTitle;
  return a.id.localeCompare(b.id);
}

export function withCategoryUpdate(
  category: Category,
  patch: Partial<{
    slug: string;
    title: string;
    description: string | null;
    sortOrder: number;
    status: TaxonomyStatus;
  }>,
  now: IsoDateTime,
): Category {
  return {
    ...category,
    slug: patch.slug !== undefined ? parseSlug(patch.slug) : category.slug,
    title:
      patch.title !== undefined ? parseTitle(patch.title) : category.title,
    description:
      patch.description !== undefined
        ? patch.description?.trim() || null
        : category.description,
    sortOrder:
      patch.sortOrder !== undefined
        ? parseSortOrder(patch.sortOrder)
        : category.sortOrder,
    status: patch.status ?? category.status,
    updatedAt: now,
    revision: nextRevision(category.revision),
  };
}

export function moveCategory(
  category: Category,
  newParentId: string | null,
  all: readonly Category[],
  now: IsoDateTime,
): Category {
  const parentId = newParentId ? CategoryIdP.parse(newParentId) : null;
  assertNoCategoryCycle(all, category.id, parentId);
  return {
    ...category,
    parentId,
    updatedAt: now,
    revision: nextRevision(category.revision),
  };
}

export function createTag(input: {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  now: IsoDateTime;
}): Tag {
  return {
    id: TagIdP.parse(input.id),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title),
    description: input.description?.trim() || null,
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
    revision: initialRevision(),
  };
}

export function assertUniqueTagTitle(
  existing: readonly Tag[],
  title: string,
  excludeId?: TagId,
): void {
  const key = normalizeTitleKey(title);
  for (const tag of existing) {
    if (excludeId && tag.id === excludeId) continue;
    if (normalizeTitleKey(tag.title) === key) {
      throw new DuplicateTitleError("Duplicate tag title", {
        adminCode: "DUPLICATE_TITLE",
        title,
      });
    }
  }
}

export function withTagUpdate(
  tag: Tag,
  patch: Partial<{
    slug: string;
    title: string;
    description: string | null;
    status: TaxonomyStatus;
  }>,
  now: IsoDateTime,
): Tag {
  return {
    ...tag,
    slug: patch.slug !== undefined ? parseSlug(patch.slug) : tag.slug,
    title: patch.title !== undefined ? parseTitle(patch.title) : tag.title,
    description:
      patch.description !== undefined
        ? patch.description?.trim() || null
        : tag.description,
    status: patch.status ?? tag.status,
    updatedAt: now,
    revision: nextRevision(tag.revision),
  };
}

export function createAudience(input: {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  sortOrder?: number;
  now: IsoDateTime;
}): Audience {
  return {
    id: AudienceIdP.parse(input.id),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title),
    description: input.description?.trim() || null,
    sortOrder: parseSortOrder(input.sortOrder ?? 0),
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
    revision: initialRevision(),
  };
}

export function withAudienceUpdate(
  audience: Audience,
  patch: Partial<{
    slug: string;
    title: string;
    description: string | null;
    sortOrder: number;
    status: TaxonomyStatus;
  }>,
  now: IsoDateTime,
): Audience {
  return {
    ...audience,
    slug: patch.slug !== undefined ? parseSlug(patch.slug) : audience.slug,
    title:
      patch.title !== undefined ? parseTitle(patch.title) : audience.title,
    description:
      patch.description !== undefined
        ? patch.description?.trim() || null
        : audience.description,
    sortOrder:
      patch.sortOrder !== undefined
        ? parseSortOrder(patch.sortOrder)
        : audience.sortOrder,
    status: patch.status ?? audience.status,
    updatedAt: now,
    revision: nextRevision(audience.revision),
  };
}
