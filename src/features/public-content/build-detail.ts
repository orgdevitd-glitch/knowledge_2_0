import type { Article } from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import type { Prompt } from "@/domain/content/prompt";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import { PUBLIC_CONTENT_LIMITS } from "./limits";
import {
  buildTableOfContents,
  buildTaxonomyMaps,
  mapTaxonomyRefs,
  promptUrl,
  toArticleSummary,
  toPromptSummary,
} from "./mappers";
import type { ArticleDetail, MaterialSummary, PromptDetail } from "./read-models";
import { filterPublished } from "./visibility";

export type PublicCatalogSnapshot = {
  articles: readonly Article[];
  prompts: readonly Prompt[];
  categories: readonly Category[];
  tags: readonly Tag[];
  audiences: readonly Audience[];
};

/** Working copy or published snapshot — enough to build the public read model. */
export type ArticleWorkingCopy = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  blocks: readonly ContentBlock[];
  categoryIds: readonly string[];
  tagIds: readonly string[];
  audienceIds: readonly string[];
  relatedArticleIds: readonly string[];
  relatedPromptIds: readonly string[];
  updatedAt: string;
  publishedAt: string | null;
  reviewDueAt: string | null;
};

export type PromptWorkingCopy = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  promptText: string;
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  categoryIds: readonly string[];
  tagIds: readonly string[];
  audienceIds: readonly string[];
  relatedArticleIds: readonly string[];
  updatedAt: string;
  publishedAt: string | null;
  reviewDueAt: string | null;
};

export type DetailBuildOptions = {
  onMissingPrompt?: (promptId: string) => void;
};

function asArticle(input: ArticleWorkingCopy): Article {
  return input as Article;
}

function asPrompt(input: PromptWorkingCopy): Prompt {
  return input as Prompt;
}

/**
 * Related/prompt hydration is published-only, even when `input` is a draft.
 * Preview of this material's body may be unpublished; peers are not.
 */
export function resolveRelatedMaterials(
  relatedArticleIds: readonly string[],
  relatedPromptIds: readonly string[],
  catalog: PublicCatalogSnapshot,
  now: string,
  excludeId: string,
): MaterialSummary[] {
  const maps = buildTaxonomyMaps(
    catalog.categories,
    catalog.tags,
    catalog.audiences,
  );
  const byArticle = new Map(
    filterPublished(catalog.articles).map((a) => [a.id as string, a]),
  );
  const byPrompt = new Map(
    filterPublished(catalog.prompts).map((p) => [p.id as string, p]),
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

function collectRelatedFromBlocks(blocks: readonly ContentBlock[]): {
  articles: string[];
  prompts: string[];
} {
  const articles: string[] = [];
  const prompts: string[] = [];
  for (const block of blocks) {
    if (block.type !== "related-content") continue;
    for (const item of block.data.items) {
      if (item.entityType === "article") articles.push(item.entityId);
      if (item.entityType === "prompt") prompts.push(item.entityId);
    }
  }
  return { articles, prompts };
}

export function buildArticleDetail(
  article: ArticleWorkingCopy,
  catalog: PublicCatalogSnapshot,
  now: string,
  options: DetailBuildOptions = {},
): ArticleDetail {
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
      options.onMissingPrompt?.(id);
      continue;
    }
    promptLookup[id] = {
      id: prompt.id,
      slug: prompt.slug,
      title: prompt.title,
      summary: prompt.summary,
      promptText: prompt.promptText,
      url: promptUrl(prompt.slug),
    };
  }

  const fromBlocks = collectRelatedFromBlocks(article.blocks);
  const related = resolveRelatedMaterials(
    [...article.relatedArticleIds, ...fromBlocks.articles],
    [...article.relatedPromptIds, ...fromBlocks.prompts],
    catalog,
    now,
    article.id,
  );

  const categories = mapTaxonomyRefs(article.categoryIds, maps.categories);
  const tags = mapTaxonomyRefs(article.tagIds, maps.tags);
  const audiences = mapTaxonomyRefs(article.audienceIds, maps.audiences);
  const summary = toArticleSummary(asArticle(article), maps, now);

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
    blocks: [...article.blocks],
    tableOfContents: toc,
    relatedMaterials: related,
    promptLookup,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt ?? article.updatedAt,
    reviewStatus: summary.reviewStatus,
  };
}

export function buildPromptDetail(
  prompt: PromptWorkingCopy,
  catalog: PublicCatalogSnapshot,
  now: string,
): PromptDetail {
  const maps = buildTaxonomyMaps(
    catalog.categories,
    catalog.tags,
    catalog.audiences,
  );
  const summary = toPromptSummary(asPrompt(prompt), maps, now);
  const related = resolveRelatedMaterials(
    prompt.relatedArticleIds,
    [],
    catalog,
    now,
    prompt.id,
  );

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
      categories: mapTaxonomyRefs(prompt.categoryIds, maps.categories),
      audiences: mapTaxonomyRefs(prompt.audienceIds, maps.audiences),
      tags: mapTaxonomyRefs(prompt.tagIds, maps.tags),
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
