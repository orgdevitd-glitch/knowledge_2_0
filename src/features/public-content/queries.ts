import "server-only";

import type { Article } from "@/domain/content/article";
import type { Prompt } from "@/domain/content/prompt";
import {
  getPublicClock,
  getPublicContentSource,
} from "@/server/composition/public-content";
import { logger } from "@/lib/logger";
import { PUBLIC_CONTENT_LIMITS } from "./limits";
import {
  buildTableOfContents,
  buildTaxonomyMaps,
  toArticleSummary,
  toPromptSummary,
} from "./mappers";
import type {
  ArticleDetail,
  HomePageModel,
  MaterialSummary,
  PromptDetail,
} from "./read-models";
import {
  buildCatalogPage,
  buildSearchDocuments,
  type CatalogQueryInput,
} from "./catalog";
import { runBasicSearch, type SearchInput } from "./search";
import { filterPublished, isPubliclyVisible } from "./visibility";

async function load() {
  const source = getPublicContentSource();
  return source.loadCatalog();
}

function resolveRelated(
  relatedArticleIds: readonly string[],
  relatedPromptIds: readonly string[],
  articles: readonly Article[],
  prompts: readonly Prompt[],
  categories: Parameters<typeof buildTaxonomyMaps>[0],
  tags: Parameters<typeof buildTaxonomyMaps>[1],
  audiences: Parameters<typeof buildTaxonomyMaps>[2],
  now: string,
  excludeId: string,
): MaterialSummary[] {
  const maps = buildTaxonomyMaps(categories, tags, audiences);
  const byArticle = new Map(
    filterPublished(articles).map((a) => [a.id as string, a]),
  );
  const byPrompt = new Map(
    filterPublished(prompts).map((p) => [p.id as string, p]),
  );
  const out: MaterialSummary[] = [];
  const seen = new Set<string>([excludeId]);

  for (const id of relatedArticleIds) {
    if (seen.has(id)) continue;
    const article = byArticle.get(id);
    if (!article) continue;
    seen.add(id);
    out.push(toArticleSummary(article, maps, now));
    if (out.length >= PUBLIC_CONTENT_LIMITS.relatedMaterials) return out;
  }
  for (const id of relatedPromptIds) {
    if (seen.has(id)) continue;
    const prompt = byPrompt.get(id);
    if (!prompt) continue;
    seen.add(id);
    out.push(toPromptSummary(prompt, maps, now));
    if (out.length >= PUBLIC_CONTENT_LIMITS.relatedMaterials) return out;
  }

  out.sort((a, b) => {
    const u = b.updatedAt.localeCompare(a.updatedAt);
    return u !== 0 ? u : a.title.localeCompare(b.title, "ru");
  });
  return out;
}

export async function getHomePageModel(): Promise<HomePageModel> {
  const catalog = await load();
  const now = getPublicClock().now();
  const page = buildCatalogPage(
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    { sort: "updated-desc", page: 1 },
  );
  const promptsOnly = buildCatalogPage(
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    { sort: "updated-desc", page: 1 },
    "prompt",
  );

  return {
    categories: page.categoryOptions,
    audiences: page.audienceOptions,
    recentMaterials: page.items.slice(
      0,
      PUBLIC_CONTENT_LIMITS.homeRecentMaterials,
    ),
    recentPrompts: promptsOnly.items.slice(
      0,
      PUBLIC_CONTENT_LIMITS.homePrompts,
    ),
  };
}

export async function getCatalogPage(input: CatalogQueryInput) {
  const catalog = await load();
  const now = getPublicClock().now();
  return buildCatalogPage(
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    input,
  );
}

export async function getArticlesCatalogPage(input: CatalogQueryInput) {
  const catalog = await load();
  const now = getPublicClock().now();
  return buildCatalogPage(
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    input,
    "article",
  );
}

export async function getPromptsCatalogPage(input: CatalogQueryInput) {
  const catalog = await load();
  const now = getPublicClock().now();
  return buildCatalogPage(
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    input,
    "prompt",
  );
}

export async function getPublishedArticleBySlug(
  slug: string,
): Promise<ArticleDetail | null> {
  const catalog = await load();
  const article = catalog.articles.find((a) => a.slug === slug);
  if (!article || !isPubliclyVisible(article.status)) {
    return null;
  }

  const now = getPublicClock().now();
  const maps = buildTaxonomyMaps(
    catalog.categories,
    catalog.tags,
    catalog.audiences,
  );
  const toc = buildTableOfContents(article.blocks);

  const promptIds = new Set<string>();
  for (const block of article.blocks) {
    if (block.type === "prompt") {
      promptIds.add(block.data.promptId);
    }
  }
  for (const id of article.relatedPromptIds) {
    promptIds.add(id);
  }

  const publishedPrompts = filterPublished(catalog.prompts);
  const promptById = new Map(publishedPrompts.map((p) => [p.id as string, p]));
  const promptLookup: ArticleDetail["promptLookup"] = {};

  for (const id of promptIds) {
    const prompt = promptById.get(id);
    if (!prompt) {
      logger.warn("content integrity: missing published prompt reference", {
        articleSlug: article.slug,
        promptId: id,
      });
      continue;
    }
    promptLookup[id] = {
      id: prompt.id,
      slug: prompt.slug,
      title: prompt.title,
      summary: prompt.summary,
      promptText: prompt.promptText,
      url: `/prompts/${prompt.slug}`,
    };
  }

  const relatedFromBlocks: string[] = [];
  const relatedPromptFromBlocks: string[] = [];
  for (const block of article.blocks) {
    if (block.type === "related-content") {
      for (const item of block.data.items) {
        if (item.entityType === "article") relatedFromBlocks.push(item.entityId);
        if (item.entityType === "prompt") {
          relatedPromptFromBlocks.push(item.entityId);
        }
      }
    }
  }

  const related = resolveRelated(
    [...article.relatedArticleIds, ...relatedFromBlocks],
    [...article.relatedPromptIds, ...relatedPromptFromBlocks],
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    article.id,
  );

  const categories = article.categoryIds
    .map((id) => maps.categories.get(id))
    .filter(Boolean)
    .map((c) => ({ id: c!.id, slug: c!.slug, title: c!.title }));
  const tags = article.tagIds
    .map((id) => maps.tags.get(id))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, slug: t!.slug, title: t!.title }));
  const audiences = article.audienceIds
    .map((id) => maps.audiences.get(id))
    .filter(Boolean)
    .map((a) => ({ id: a!.id, slug: a!.slug, title: a!.title }));

  const summary = toArticleSummary(article, maps, now);

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    metadata: {
      typeLabel: "Статья",
      categories,
      audiences,
      tags,
      updatedAt: article.updatedAt,
      publishedAt: article.publishedAt ?? article.updatedAt,
      reviewStatus: summary.reviewStatus,
    },
    blocks: article.blocks,
    tableOfContents: toc,
    relatedMaterials: related,
    promptLookup,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt ?? article.updatedAt,
    reviewStatus: summary.reviewStatus,
  };
}

export async function getPublishedPromptBySlug(
  slug: string,
): Promise<PromptDetail | null> {
  const catalog = await load();
  const prompt = catalog.prompts.find((p) => p.slug === slug);
  if (!prompt || !isPubliclyVisible(prompt.status)) {
    return null;
  }

  const now = getPublicClock().now();
  const maps = buildTaxonomyMaps(
    catalog.categories,
    catalog.tags,
    catalog.audiences,
  );
  const summary = toPromptSummary(prompt, maps, now);
  const related = resolveRelated(
    prompt.relatedArticleIds,
    [],
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
    now,
    prompt.id,
  );

  const categories = prompt.categoryIds
    .map((id) => maps.categories.get(id))
    .filter(Boolean)
    .map((c) => ({ id: c!.id, slug: c!.slug, title: c!.title }));
  const tags = prompt.tagIds
    .map((id) => maps.tags.get(id))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, slug: t!.slug, title: t!.title }));
  const audiences = prompt.audienceIds
    .map((id) => maps.audiences.get(id))
    .filter(Boolean)
    .map((a) => ({ id: a!.id, slug: a!.slug, title: a!.title }));

  return {
    id: prompt.id,
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    promptText: prompt.promptText,
    inputRequirements: prompt.inputRequirements,
    outputRequirements: prompt.outputRequirements,
    restrictions: prompt.restrictions,
    usageExample: prompt.usageExample,
    metadata: {
      typeLabel: "Промт",
      categories,
      audiences,
      tags,
      updatedAt: prompt.updatedAt,
      publishedAt: prompt.publishedAt ?? prompt.updatedAt,
      reviewStatus: summary.reviewStatus,
    },
    relatedMaterials: related,
    updatedAt: prompt.updatedAt,
    publishedAt: prompt.publishedAt ?? prompt.updatedAt,
    reviewStatus: summary.reviewStatus,
  };
}

export async function searchPublicContent(input: SearchInput) {
  const catalog = await load();
  const docs = buildSearchDocuments(
    catalog.articles,
    catalog.prompts,
    catalog.categories,
    catalog.tags,
    catalog.audiences,
  );
  return runBasicSearch(docs, input);
}
