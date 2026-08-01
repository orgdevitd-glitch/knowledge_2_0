import type { Article } from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import type { Prompt } from "@/domain/content/prompt";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import { richTextToPlain } from "@/domain/shared/rich-text";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import { PUBLIC_CONTENT_LIMITS } from "./limits";
import type {
  MaterialSummary,
  TocItem,
} from "./read-models";
import {
  resolveReviewStatus,
  type ReviewStatus,
} from "./review-status";

export function articleUrl(slug: string): string {
  return `/articles/${slug}`;
}

export function promptUrl(slug: string): string {
  return `/prompts/${slug}`;
}

type TaxonomyMaps = {
  categories: Map<string, Category>;
  tags: Map<string, Tag>;
  audiences: Map<string, Audience>;
};

export function buildTaxonomyMaps(
  categories: readonly Category[],
  tags: readonly Tag[],
  audiences: readonly Audience[],
): TaxonomyMaps {
  return {
    categories: new Map(categories.map((c) => [c.id, c])),
    tags: new Map(tags.map((t) => [t.id, t])),
    audiences: new Map(audiences.map((a) => [a.id, a])),
  };
}

function mapRefs<T extends { id: string; slug: string; title: string }>(
  ids: readonly string[],
  map: Map<string, T>,
): { id: string; slug: string; title: string }[] {
  const out: { id: string; slug: string; title: string }[] = [];
  for (const id of ids) {
    const item = map.get(id);
    if (item) {
      out.push({ id: item.id, slug: item.slug, title: item.title });
    }
  }
  return out;
}

export function toArticleSummary(
  article: Article,
  maps: TaxonomyMaps,
  now: IsoDateTime | string,
): MaterialSummary {
  const categories = mapRefs(article.categoryIds, maps.categories);
  const reviewStatus: ReviewStatus = resolveReviewStatus(
    article.reviewDueAt,
    now,
  );
  return {
    id: article.id,
    type: "article",
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: categories[0] ?? null,
    tags: mapRefs(article.tagIds, maps.tags),
    audiences: mapRefs(article.audienceIds, maps.audiences),
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt ?? article.updatedAt,
    reviewStatus,
    url: articleUrl(article.slug),
  };
}

export function toPromptSummary(
  prompt: Prompt,
  maps: TaxonomyMaps,
  now: IsoDateTime | string,
): MaterialSummary {
  const categories = mapRefs(prompt.categoryIds, maps.categories);
  return {
    id: prompt.id,
    type: "prompt",
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    category: categories[0] ?? null,
    tags: mapRefs(prompt.tagIds, maps.tags),
    audiences: mapRefs(prompt.audienceIds, maps.audiences),
    updatedAt: prompt.updatedAt,
    publishedAt: prompt.publishedAt ?? prompt.updatedAt,
    reviewStatus: resolveReviewStatus(prompt.reviewDueAt, now),
    url: promptUrl(prompt.slug),
  };
}

export function buildTableOfContents(blocks: readonly ContentBlock[]): TocItem[] {
  const used = new Map<string, number>();
  const items: TocItem[] = [];

  for (const block of blocks) {
    if (block.type !== "heading") continue;
    const level = block.data.level;
    const text = block.data.text;
    const base =
      block.settings.anchor ??
      slugifyAnchor(text) ??
      `section-${block.id}`;
    let anchor = base;
    const count = used.get(base) ?? 0;
    if (count > 0) {
      anchor = `${base}-${count + 1}`;
    }
    used.set(base, count + 1);
    items.push({
      id: block.id,
      level,
      text,
      anchor,
    });
    if (items.length >= PUBLIC_CONTENT_LIMITS.tocMaxItems) break;
  }
  return items;
}

function slugifyAnchor(text: string): string | null {
  const lower = text.normalize("NFKC").toLowerCase().trim();
  let out = "";
  for (const ch of lower) {
    if (/[a-z0-9а-яё]/.test(ch)) out += ch;
    else if (/[\s_/.,;:]+/.test(ch) || ch === "-") out += "-";
  }
  out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return out || null;
}

export function headingAnchorForBlock(
  block: ContentBlock,
  toc: readonly TocItem[],
): string | undefined {
  if (block.type !== "heading") return undefined;
  return toc.find((t) => t.id === block.id)?.anchor;
}

export function blockToPlainText(block: ContentBlock): string {
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
    default:
      return "";
  }
}

export function articlePlainText(article: Article): string {
  const parts = [
    article.title,
    article.summary ?? "",
    ...article.blocks.map(blockToPlainText),
  ];
  return parts.join("\n").slice(0, PUBLIC_CONTENT_LIMITS.searchMaxIndexedChars);
}

export function promptPlainText(prompt: Prompt): string {
  return [
    prompt.title,
    prompt.summary ?? "",
    prompt.promptText,
    prompt.inputRequirements ?? "",
    prompt.outputRequirements ?? "",
    prompt.restrictions ?? "",
  ]
    .join("\n")
    .slice(0, PUBLIC_CONTENT_LIMITS.searchMaxIndexedChars);
}
