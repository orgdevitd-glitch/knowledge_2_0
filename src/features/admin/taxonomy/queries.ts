import "server-only";

import {
  buildCategoryTree,
  compareTaxonomyOrder,
} from "@/features/content/application/taxonomy-use-cases";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import {
  getContentPorts,
  isContentPersistenceAvailable,
} from "@/server/composition/content-ports";
import { TaxonomyUsageService } from "./application/taxonomy-usage-service";
import type {
  AdminAudienceDto,
  AdminCategoryDto,
  AdminCategoryTreeNode,
  AdminTagDto,
  TaxonomyDashboardDto,
  TaxonomyDashboardSection,
  TaxonomyUsageSummary,
} from "./types";

function toCategoryDto(
  c: Category,
  extras?: Partial<AdminCategoryDto>,
): AdminCategoryDto {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    status: c.status,
    revision: c.revision,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ...extras,
  };
}

function toTagDto(t: Tag, extras?: Partial<AdminTagDto>): AdminTagDto {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    status: t.status,
    revision: t.revision,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    ...extras,
  };
}

function toAudienceDto(
  a: Audience,
  extras?: Partial<AdminAudienceDto>,
): AdminAudienceDto {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    sortOrder: a.sortOrder,
    status: a.status,
    revision: a.revision,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    ...extras,
  };
}

async function usageCountMap(
  kind: "category" | "tag" | "audience",
  ids: string[],
): Promise<Map<string, number>> {
  const ports = getContentPorts();
  const usage = new TaxonomyUsageService(ports);
  const map = new Map<string, number>();
  // Bounded: dashboard/lists compute usage per entity sequentially but capped set.
  for (const id of ids.slice(0, 200)) {
    const summary = await usage.getSummary(kind, id);
    map.set(id, summary.totalCount);
  }
  return map;
}

async function sectionStats(
  kind: "category" | "tag" | "audience",
  items: Array<{ id: string; status: string }>,
): Promise<TaxonomyDashboardSection> {
  const active = items.filter((i) => i.status === "active");
  const archived = items.filter((i) => i.status === "archived");
  const counts = await usageCountMap(
    kind,
    items.map((i) => i.id),
  );
  let usedCount = 0;
  for (const item of items) {
    if ((counts.get(item.id) ?? 0) > 0) usedCount += 1;
  }
  return {
    activeCount: active.length,
    archivedCount: archived.length,
    totalCount: items.length,
    usedCount,
    unusedCount: items.length - usedCount,
  };
}

export async function getTaxonomyDashboard(): Promise<TaxonomyDashboardDto> {
  if (!isContentPersistenceAvailable()) {
    const empty = {
      activeCount: 0,
      archivedCount: 0,
      totalCount: 0,
      usedCount: 0,
      unusedCount: 0,
    };
    return { categories: empty, tags: empty, audiences: empty };
  }
  const ports = getContentPorts();
  const [categories, tags, audiences] = await Promise.all([
    ports.categories.listAll(),
    ports.tags.listAll(),
    ports.audiences.listAll(),
  ]);
  const [catSection, tagSection, audSection] = await Promise.all([
    sectionStats("category", categories),
    sectionStats("tag", tags),
    sectionStats("audience", audiences),
  ]);
  return {
    categories: catSection,
    tags: tagSection,
    audiences: audSection,
  };
}

export async function listCategoryTree(options?: {
  query?: string;
  status?: "active" | "archived" | "all";
}): Promise<AdminCategoryTreeNode[]> {
  if (!isContentPersistenceAvailable()) return [];
  const ports = getContentPorts();
  const all = await ports.categories.listAll();
  const status = options?.status ?? "all";
  const q = options?.query?.trim().toLowerCase() ?? "";

  const filtered = all.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  });

  // For search, show flat-matching nodes with depth from full tree context.
  if (q) {
    const tree = buildCategoryTree(all);
    const flat: AdminCategoryTreeNode[] = [];
    const walk = (nodes: ReturnType<typeof buildCategoryTree>) => {
      for (const node of nodes) {
        if (filtered.some((f) => f.id === node.id)) {
          flat.push({
            ...toCategoryDto(node),
            depth: node.depth,
            childCount: node.childCount,
            children: [],
          });
        }
        walk(node.children);
      }
    };
    walk(tree);
    const counts = await usageCountMap(
      "category",
      flat.map((n) => n.id),
    );
    return flat.map((n) => ({
      ...n,
      usageCount: counts.get(n.id) ?? 0,
    }));
  }

  const tree = buildCategoryTree(
    status === "all" ? all : all.filter((c) => c.status === status),
  );
  const counts = await usageCountMap(
    "category",
    all.map((c) => c.id),
  );

  const mapNode = (
    node: ReturnType<typeof buildCategoryTree>[number],
  ): AdminCategoryTreeNode => ({
    ...toCategoryDto(node),
    depth: node.depth,
    childCount: node.childCount,
    usageCount: counts.get(node.id) ?? 0,
    children: node.children.map(mapNode),
  });
  return tree.map(mapNode);
}

export async function getCategoryDetail(
  categoryId: string,
): Promise<(AdminCategoryDto & { usageCount: number }) | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const category = await ports.categories.getById(categoryId);
  if (!category) return null;
  const usage = await new TaxonomyUsageService(ports).getSummary(
    "category",
    categoryId,
  );
  const all = await ports.categories.listAll();
  const childCount = all.filter((c) => c.parentId === category.id).length;
  return {
    ...toCategoryDto(category),
    childCount,
    usageCount: usage.totalCount,
  };
}

export async function listTagsAdmin(options?: {
  query?: string;
  status?: "active" | "archived" | "all";
  sort?: "title_asc" | "updated_desc" | "usage_desc";
}): Promise<AdminTagDto[]> {
  if (!isContentPersistenceAvailable()) return [];
  const ports = getContentPorts();
  let items = await ports.tags.listAll();
  const status = options?.status ?? "all";
  const q = options?.query?.trim().toLowerCase() ?? "";
  if (status !== "all") items = items.filter((t) => t.status === status);
  if (q) {
    items = items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }
  const counts = await usageCountMap(
    "tag",
    items.map((t) => t.id),
  );
  const dtos = items.map((t) =>
    toTagDto(t, { usageCount: counts.get(t.id) ?? 0 }),
  );
  const sort = options?.sort ?? "title_asc";
  dtos.sort((a, b) => {
    if (sort === "updated_desc") {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    if (sort === "usage_desc") {
      return (b.usageCount ?? 0) - (a.usageCount ?? 0);
    }
    return a.title.localeCompare(b.title, "ru");
  });
  return dtos;
}

export async function getTagDetail(
  tagId: string,
): Promise<(AdminTagDto & { usageCount: number }) | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const tag = await ports.tags.getById(tagId);
  if (!tag) return null;
  const usage = await new TaxonomyUsageService(ports).getSummary("tag", tagId);
  return { ...toTagDto(tag), usageCount: usage.totalCount };
}

export async function listAudiencesAdmin(options?: {
  query?: string;
  status?: "active" | "archived" | "all";
}): Promise<AdminAudienceDto[]> {
  if (!isContentPersistenceAvailable()) return [];
  const ports = getContentPorts();
  let items = await ports.audiences.listAll();
  const status = options?.status ?? "all";
  const q = options?.query?.trim().toLowerCase() ?? "";
  if (status !== "all") items = items.filter((a) => a.status === status);
  if (q) {
    items = items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q),
    );
  }
  items = [...items].sort(compareTaxonomyOrder);
  const counts = await usageCountMap(
    "audience",
    items.map((a) => a.id),
  );
  return items.map((a) =>
    toAudienceDto(a, { usageCount: counts.get(a.id) ?? 0 }),
  );
}

export async function getAudienceDetail(
  audienceId: string,
): Promise<(AdminAudienceDto & { usageCount: number }) | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const audience = await ports.audiences.getById(audienceId);
  if (!audience) return null;
  const usage = await new TaxonomyUsageService(ports).getSummary(
    "audience",
    audienceId,
  );
  return { ...toAudienceDto(audience), usageCount: usage.totalCount };
}

export async function getTaxonomyUsageSummary(
  kind: "category" | "tag" | "audience",
  id: string,
): Promise<TaxonomyUsageSummary | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  return new TaxonomyUsageService(ports).getSummary(kind, id);
}

export async function listParentCategoryOptions(
  excludeId?: string,
): Promise<Array<{ id: string; title: string; slug: string; depth: number }>> {
  if (!isContentPersistenceAvailable()) return [];
  const ports = getContentPorts();
  const all = await ports.categories.listAll();
  const active = all.filter((c) => c.status === "active");
  const tree = buildCategoryTree(active);
  const options: Array<{
    id: string;
    title: string;
    slug: string;
    depth: number;
  }> = [];
  const walk = (nodes: ReturnType<typeof buildCategoryTree>) => {
    for (const node of nodes) {
      if (!excludeId || node.id !== excludeId) {
        options.push({
          id: node.id,
          title: node.title,
          slug: node.slug,
          depth: node.depth,
        });
      }
      // Do not offer descendants of excludeId as parents.
      if (excludeId && node.id === excludeId) continue;
      walk(node.children);
    }
  };
  walk(tree);
  return options;
}
