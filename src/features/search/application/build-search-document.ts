import type { Article, ArticleSnapshot } from "@/domain/content/article";
import {
  articleFromPublishedSnapshot,
} from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import type { Prompt, PromptSnapshot } from "@/domain/content/prompt";
import { promptFromPublishedSnapshot } from "@/domain/content/prompt";
import { richTextToPlain } from "@/domain/shared/rich-text";
import {
  createSearchTombstone,
  searchDocumentId,
  type ActiveSearchDocument,
  type SearchDocument,
  type SearchTombstone,
} from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import {
  buildSearchableBlob,
  clampSearchableText,
  normalizeSearchText,
} from "@/domain/search/text-normalize";
import { getSearchLimits } from "@/config/search-env";
import { ValidationError } from "@/domain/shared/errors";

function extractBlockText(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return block.data.text;
    case "paragraph":
      return richTextToPlain(block.data.content);
    case "list":
      return block.data.items.join("\n");
    case "table":
      return [
        block.data.columns.join(" "),
        ...block.data.rows.map((r) => r.join(" ")),
        block.data.caption ?? "",
      ].join("\n");
    case "quote":
      return `${block.data.text} ${block.data.attribution ?? ""}`;
    case "info":
    case "warning":
    case "tip":
      return `${block.data.title ?? ""} ${block.data.body}`;
    case "steps":
      return block.data.items
        .map((s) => `${s.title} ${s.description}`)
        .join("\n");
    case "checklist":
      return block.data.items.map((i) => i.text).join("\n");
    case "faq":
      return block.data.items
        .map((i) => `${i.question} ${i.answer}`)
        .join("\n");
    case "code":
      return block.data.code;
    case "link":
    case "button":
      return block.data.label;
    case "image": {
      const alt = block.data.decorative ? "" : block.data.alt;
      const caption = block.data.caption ?? "";
      return `${alt} ${caption}`.trim();
    }
    case "gallery":
      return block.data.items
        .map((i) => {
          const alt = i.decorative ? "" : i.alt;
          return `${alt} ${i.caption ?? ""}`.trim();
        })
        .filter(Boolean)
        .join("\n");
    case "file":
      return `${block.data.title} ${block.data.description ?? ""}`.trim();
    case "video":
      return block.data.title;
    default:
      return "";
  }
}

export function buildArticleSearchDocument(input: {
  live: Article;
  snapshot: ArticleSnapshot;
  versionId: string;
  versionNumber: number;
}): ActiveSearchDocument {
  const { live, snapshot, versionId, versionNumber } = input;
  if (live.status !== "published" || !live.publishedVersion) {
    throw new ValidationError(
      "SearchDocument requires a published article with publishedVersion",
      { adminCode: "SEARCH_INDEX_INVALID_SOURCE" },
    );
  }
  if (live.publishedVersion !== versionId) {
    throw new ValidationError(
      "versionId must match live publishedVersion",
      { adminCode: "SEARCH_INDEX_INVALID_SOURCE" },
    );
  }

  const material = articleFromPublishedSnapshot(live, snapshot);
  const limits = getSearchLimits();
  const headings = material.blocks
    .filter((b) => b.type === "heading")
    .map((b) => (b.type === "heading" ? normalizeSearchText(b.data.text) : ""))
    .filter(Boolean);
  const bodyParts = material.blocks.map(extractBlockText);
  const bodyText = clampSearchableText(
    bodyParts.map(normalizeSearchText).filter(Boolean).join("\n"),
    limits.maxDocumentCharacters,
  );
  const title = normalizeSearchText(material.title);
  const summary = material.summary
    ? normalizeSearchText(material.summary)
    : null;
  const searchableText = buildSearchableBlob([
    title,
    summary,
    ...headings,
    bodyText,
  ]);

  return {
    id: searchDocumentId("article", live.id as string),
    entityType: "article",
    entityId: live.id as string,
    sourceRevision: live.revision as number,
    versionId,
    versionNumber,
    state: "active",
    slug: material.slug as string,
    href: `/articles/${material.slug}`,
    title,
    summary,
    bodyText,
    promptText: null,
    headings,
    categoryIds: [...material.categoryIds] as string[],
    tagIds: [...material.tagIds] as string[],
    audienceIds: [...material.audienceIds] as string[],
    publishedAt: material.publishedAt ?? material.updatedAt,
    searchableText,
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
  };
}

export function buildPromptSearchDocument(input: {
  live: Prompt;
  snapshot: PromptSnapshot;
  versionId: string;
  versionNumber: number;
}): ActiveSearchDocument {
  const { live, snapshot, versionId, versionNumber } = input;
  if (live.status !== "published" || !live.publishedVersion) {
    throw new ValidationError(
      "SearchDocument requires a published prompt with publishedVersion",
      { adminCode: "SEARCH_INDEX_INVALID_SOURCE" },
    );
  }
  if (live.publishedVersion !== versionId) {
    throw new ValidationError(
      "versionId must match live publishedVersion",
      { adminCode: "SEARCH_INDEX_INVALID_SOURCE" },
    );
  }

  const material = promptFromPublishedSnapshot(live, snapshot);
  const limits = getSearchLimits();
  const title = normalizeSearchText(material.title);
  const summary = material.summary
    ? normalizeSearchText(material.summary)
    : null;
  const promptText = clampSearchableText(
    [
      material.promptText,
      material.inputRequirements,
      material.outputRequirements,
      material.restrictions,
      material.usageExample,
    ]
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map(normalizeSearchText)
      .join("\n"),
    limits.maxDocumentCharacters,
  );

  return {
    id: searchDocumentId("prompt", live.id as string),
    entityType: "prompt",
    entityId: live.id as string,
    sourceRevision: live.revision as number,
    versionId,
    versionNumber,
    state: "active",
    slug: material.slug as string,
    href: `/prompts/${material.slug}`,
    title,
    summary,
    bodyText: "",
    promptText,
    headings: [],
    categoryIds: [...material.categoryIds] as string[],
    tagIds: [...material.tagIds] as string[],
    audienceIds: [...material.audienceIds] as string[],
    publishedAt: material.publishedAt ?? material.updatedAt,
    searchableText: buildSearchableBlob([title, summary, promptText]),
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
  };
}

export function tombstoneForEntity(input: {
  entityType: "article" | "prompt";
  entityId: string;
  sourceRevision: number;
  versionId?: string | null;
  versionNumber?: number | null;
}): SearchTombstone {
  return createSearchTombstone(input);
}

export function serializeSearchDocuments(
  documents: readonly SearchDocument[],
): string {
  const sorted = [...documents].sort((a, b) => a.id.localeCompare(b.id));
  return `${JSON.stringify({
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
    documents: sorted,
  })}\n`;
}
