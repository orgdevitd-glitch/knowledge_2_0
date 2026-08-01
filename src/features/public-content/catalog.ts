import type { Article } from "@/domain/content/article";
import type { Prompt } from "@/domain/content/prompt";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import {
  PUBLIC_CONTENT_LIMITS,
  PUBLIC_SORTS,
  type PublicMaterialType,
  type PublicSort,
} from "./limits";
import {
  articlePlainText,
  buildTaxonomyMaps,
  promptPlainText,
  toArticleSummary,
  toPromptSummary,
} from "./mappers";
import type {
  CatalogPageModel,
  MaterialSummary,
  SearchDocument,
  TaxonomyOption,
} from "./read-models";
import { filterPublished } from "./visibility";

export type CatalogQueryInput = {
  type?: string | null;
  category?: string | null;
  audience?: string | null;
  sort?: string | null;
  q?: string | null;
  page?: string | number | null;
};

function parseSort(value: string | null | undefined): PublicSort {
  if (value && (PUBLIC_SORTS as readonly string[]).includes(value)) {
    return value as PublicSort;
  }
  return "updated-desc";
}

function parseType(value: string | null | undefined): PublicMaterialType | null {
  if (value === "article" || value === "prompt") return value;
  return null;
}

function parsePage(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function sortSummaries(
  items: MaterialSummary[],
  sort: PublicSort,
): MaterialSummary[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (sort) {
      case "published-desc": {
        const cmp = b.publishedAt.localeCompare(a.publishedAt);
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title, "ru");
      }
      case "title-asc":
        return a.title.localeCompare(b.title, "ru");
      case "updated-desc":
      default: {
        const cmp = b.updatedAt.localeCompare(a.updatedAt);
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title, "ru");
      }
    }
  });
  return copy;
}

export function buildAllSummaries(
  articles: readonly Article[],
  prompts: readonly Prompt[],
  categories: readonly Category[],
  tags: readonly Tag[],
  audiences: readonly Audience[],
  now: IsoDateTime | string,
): MaterialSummary[] {
  const maps = buildTaxonomyMaps(categories, tags, audiences);
  const publishedArticles = filterPublished(articles);
  const publishedPrompts = filterPublished(prompts);
  return [
    ...publishedArticles.map((a) => toArticleSummary(a, maps, now)),
    ...publishedPrompts.map((p) => toPromptSummary(p, maps, now)),
  ];
}

export function buildCatalogPage(
  articles: readonly Article[],
  prompts: readonly Prompt[],
  categories: readonly Category[],
  tags: readonly Tag[],
  audiences: readonly Audience[],
  now: IsoDateTime | string,
  input: CatalogQueryInput,
  fixedType?: PublicMaterialType,
): CatalogPageModel {
  const type = fixedType ?? parseType(input.type);
  const category = input.category?.trim() || null;
  const audience = input.audience?.trim() || null;
  const sort = parseSort(input.sort);
  const q = input.q?.trim() || null;
  const page = parsePage(input.page);
  const pageSize = PUBLIC_CONTENT_LIMITS.catalogPageSize;

  let items = buildAllSummaries(
    articles,
    prompts,
    categories,
    tags,
    audiences,
    now,
  );

  if (type) {
    items = items.filter((i) => i.type === type);
  }
  if (category) {
    items = items.filter(
      (i) =>
        i.category?.slug === category ||
        i.tags.some((t) => t.slug === category),
    );
  }
  if (audience) {
    items = items.filter((i) => i.audiences.some((a) => a.slug === audience));
  }
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(needle) ||
        (i.summary?.toLowerCase().includes(needle) ?? false),
    );
  }

  items = sortSummaries(items, sort);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  // Filter option counts from full published set (before catalog filters except fixed type).
  const baseForCounts = buildAllSummaries(
    articles,
    prompts,
    categories,
    tags,
    audiences,
    now,
  ).filter((i) => (fixedType ? i.type === fixedType : true));

  return {
    items: pageItems,
    total,
    page: safePage,
    pageSize,
    totalPages,
    filters: {
      type,
      category,
      audience,
      sort,
      q,
    },
    typeOptions: [
      {
        id: "article",
        slug: "article",
        title: "Статьи",
        count: baseForCounts.filter((i) => i.type === "article").length,
      },
      {
        id: "prompt",
        slug: "prompt",
        title: "Промты",
        count: baseForCounts.filter((i) => i.type === "prompt").length,
      },
    ].filter((o) => o.count > 0),
    categoryOptions: buildCategoryOptions(categories, baseForCounts),
    audienceOptions: buildAudienceOptions(audiences, baseForCounts),
  };
}

/**
 * Public filter policy (ADR 0009):
 * Counts come from catalog materials already hydrated from publishedVersion
 * snapshots (not working drafts). Therefore:
 * - active taxonomy with published-snapshot usage → filter option
 * - archived taxonomy with published-snapshot usage → legacy filter option
 * - archived with draft-only usage (not in snapshots) → omitted
 * - archiving never hides materials; metadata titles still resolve by id
 */
function buildCategoryOptions(
  categories: readonly Category[],
  items: MaterialSummary[],
): TaxonomyOption[] {
  return categories
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      count: items.filter((i) => i.category?.id === c.id).length,
    }))
    // Include archived only when still used by visible catalog items (legacy).
    .filter((o) => o.count > 0)
    .map(({ id, slug, title, count }) => ({ id, slug, title, count }))
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

function buildAudienceOptions(
  audiences: readonly Audience[],
  items: MaterialSummary[],
): TaxonomyOption[] {
  return audiences
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      count: items.filter((i) => i.audiences.some((x) => x.id === a.id)).length,
    }))
    .filter((o) => o.count > 0)
    .map(({ id, slug, title, count }) => ({ id, slug, title, count }))
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

export function buildSearchDocuments(
  articles: readonly Article[],
  prompts: readonly Prompt[],
  categories: readonly Category[],
  tags: readonly Tag[],
  audiences: readonly Audience[],
): SearchDocument[] {
  const maps = buildTaxonomyMaps(categories, tags, audiences);
  const docs: SearchDocument[] = [];

  for (const article of filterPublished(articles)) {
    const cats = article.categoryIds
      .map((id) => maps.categories.get(id)?.title)
      .filter(Boolean) as string[];
    const tagTitles = article.tagIds
      .map((id) => maps.tags.get(id)?.title)
      .filter(Boolean) as string[];
    const audTitles = article.audienceIds
      .map((id) => maps.audiences.get(id)?.title)
      .filter(Boolean) as string[];
    docs.push({
      id: article.id,
      type: "article",
      slug: article.slug,
      url: `/articles/${article.slug}`,
      title: article.title,
      summary: article.summary,
      headings: article.blocks
        .filter((b) => b.type === "heading")
        .map((b) => (b.type === "heading" ? b.data.text : "")),
      plainText: articlePlainText(article),
      categories: cats,
      tags: tagTitles,
      audiences: audTitles,
      updatedAt: article.updatedAt,
    });
  }

  for (const prompt of filterPublished(prompts)) {
    const cats = prompt.categoryIds
      .map((id) => maps.categories.get(id)?.title)
      .filter(Boolean) as string[];
    const tagTitles = prompt.tagIds
      .map((id) => maps.tags.get(id)?.title)
      .filter(Boolean) as string[];
    const audTitles = prompt.audienceIds
      .map((id) => maps.audiences.get(id)?.title)
      .filter(Boolean) as string[];
    docs.push({
      id: prompt.id,
      type: "prompt",
      slug: prompt.slug,
      url: `/prompts/${prompt.slug}`,
      title: prompt.title,
      summary: prompt.summary,
      headings: [],
      plainText: promptPlainText(prompt),
      categories: cats,
      tags: tagTitles,
      audiences: audTitles,
      updatedAt: prompt.updatedAt,
    });
  }

  return docs;
}
