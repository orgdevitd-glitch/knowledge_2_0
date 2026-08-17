import "server-only";

import { logger } from "@/lib/logger";
import {
  getPublicClock,
  getPublicContentSource,
} from "@/server/composition/public-content";
import { PUBLIC_CONTENT_LIMITS } from "./limits";
import { buildArticleDetail, buildPromptDetail } from "./build-detail";
import type {
  ArticleDetail,
  HomePageModel,
  PromptDetail,
} from "./read-models";
import { buildCatalogPage, buildSearchDocuments, type CatalogQueryInput } from "./catalog";
import { runBasicSearch, type SearchInput } from "./search";
import { isPubliclyVisible } from "./visibility";

async function load() {
  const source = getPublicContentSource();
  return source.loadCatalog();
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
  return buildArticleDetail(article, catalog, now, {
    onMissingPrompt: (promptId) => {
      logger.warn("content integrity: missing published prompt reference", {
        articleSlug: article.slug,
        promptId,
      });
    },
  });
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
  return buildPromptDetail(prompt, catalog, now);
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
