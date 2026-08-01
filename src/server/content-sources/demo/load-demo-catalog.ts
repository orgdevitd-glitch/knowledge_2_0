import "server-only";

import {
  createArticle,
  type Article,
} from "@/domain/content/article";
import { validateBlocks } from "@/domain/content/blocks";
import {
  createPrompt,
  type Prompt,
} from "@/domain/content/prompt";
import {
  createAudience,
  createCategory,
  createTag,
  type Audience,
  type Category,
  type Tag,
} from "@/domain/content/taxonomy";
import { VersionId } from "@/domain/shared/ids";
import { richTextFromPlain } from "@/domain/shared/rich-text";
import {
  parseIsoDateTime,
  parseRevision,
  type IsoDateTime,
} from "@/domain/shared/value-objects";

import {
  DEMO_RAW_DATASET,
  DEMO_TIMESTAMP,
  type DemoParagraphData,
  type DemoRawArticle,
  type DemoRawBlock,
  type DemoRawPrompt,
} from "./demo-dataset";

/**
 * DEMO / TEST ONLY — validated in-memory catalog for Phase 4 development.
 *
 * Loads raw fixtures, validates through domain factories, and returns typed entities.
 * Not for production. Do not import from Client Components.
 */

export type DemoCatalog = {
  articles: Article[];
  prompts: Prompt[];
  categories: Category[];
  tags: Tag[];
  audiences: Audience[];
};

const DEMO_NOW: IsoDateTime = parseIsoDateTime(DEMO_TIMESTAMP);

function isParagraphData(
  data: Record<string, unknown> | DemoParagraphData,
): data is DemoParagraphData {
  return (
    typeof data === "object" &&
    data !== null &&
    "plainText" in data &&
    typeof (data as DemoParagraphData).plainText === "string"
  );
}

/** Converts DEMO raw blocks: paragraph plainText → RichTextDocument, then validates. */
function loadDemoBlocks(rawBlocks: DemoRawBlock[]): ReturnType<typeof validateBlocks> {
  const prepared = rawBlocks.map((block) => {
    if (block.type === "paragraph" && isParagraphData(block.data)) {
      return {
        ...block,
        data: { content: richTextFromPlain(block.data.plainText) },
      };
    }
    return block;
  });
  return validateBlocks(prepared);
}

function loadDemoArticle(raw: DemoRawArticle): Article {
  const created = createArticle({
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary,
    coverMediaId: raw.coverMediaId,
    categoryIds: raw.categoryIds,
    tagIds: raw.tagIds,
    audienceIds: raw.audienceIds,
    ownerId: raw.ownerId,
    authorId: raw.authorId,
    blocks: loadDemoBlocks(raw.blocks),
    relatedArticleIds: raw.relatedArticleIds,
    relatedPromptIds: raw.relatedPromptIds,
    relatedVideoIds: raw.relatedVideoIds,
    now: DEMO_NOW,
  });

  return {
    ...created,
    status: raw.status,
    publishedAt: raw.publishedAt ? parseIsoDateTime(raw.publishedAt) : null,
    currentVersion: raw.currentVersion
      ? VersionId.parse(raw.currentVersion)
      : null,
    publishedVersion: raw.publishedVersion
      ? VersionId.parse(raw.publishedVersion)
      : null,
    revision: parseRevision(raw.revision),
    updatedAt: DEMO_NOW,
  };
}

function loadDemoPrompt(raw: DemoRawPrompt): Prompt {
  const created = createPrompt({
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary,
    categoryIds: raw.categoryIds,
    tagIds: raw.tagIds,
    audienceIds: raw.audienceIds,
    promptText: raw.promptText,
    inputRequirements: raw.inputRequirements,
    outputRequirements: raw.outputRequirements,
    restrictions: raw.restrictions,
    usageExample: raw.usageExample,
    relatedArticleIds: raw.relatedArticleIds,
    relatedVideoIds: raw.relatedVideoIds,
    ownerId: raw.ownerId,
    now: DEMO_NOW,
  });

  return {
    ...created,
    status: raw.status,
    publishedAt: raw.publishedAt ? parseIsoDateTime(raw.publishedAt) : null,
    currentVersion: raw.currentVersion
      ? VersionId.parse(raw.currentVersion)
      : null,
    publishedVersion: raw.publishedVersion
      ? VersionId.parse(raw.publishedVersion)
      : null,
    revision: parseRevision(raw.revision),
    updatedAt: DEMO_NOW,
  };
}

/** Loads and validates the full DEMO catalog from raw fixtures. */
export function loadDemoCatalog(): DemoCatalog {
  const categories = DEMO_RAW_DATASET.categories.map((raw) =>
    createCategory({
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      parentId: raw.parentId,
      sortOrder: raw.sortOrder,
      now: DEMO_NOW,
    }),
  );

  const tags = DEMO_RAW_DATASET.tags.map((raw) =>
    createTag({
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      now: DEMO_NOW,
    }),
  );

  const audiences = DEMO_RAW_DATASET.audiences.map((raw) =>
    createAudience({
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      sortOrder: raw.sortOrder,
      now: DEMO_NOW,
    }),
  );

  const prompts = DEMO_RAW_DATASET.prompts.map(loadDemoPrompt);
  const articles = DEMO_RAW_DATASET.articles.map(loadDemoArticle);

  return { articles, prompts, categories, tags, audiences };
}
