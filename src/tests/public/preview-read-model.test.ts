import { describe, expect, it } from "vitest";

import { BLOCK_SCHEMA_VERSION, type ContentBlock } from "@/domain/content/blocks";
import { archiveTag } from "@/domain/content/taxonomy";
import { parseIsoDateTime } from "@/domain/shared/value-objects";
import {
  buildArticleDetail,
  buildPromptDetail,
} from "@/features/public-content/build-detail";
import { taxonomyCatalogHref } from "@/features/public-content/catalog-url";
import { loadDemoCatalog } from "@/server/content-sources/demo/load-demo-catalog";

const now = "2024-06-15T12:00:00.000Z";

function heading(id: string, text: string, level: 2 | 3 | 4 = 2): ContentBlock {
  return {
    id,
    type: "heading",
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all",
    data: { level, text },
  };
}

describe("shared public/preview read models", () => {
  it("builds article preview from draft body with published-only related", () => {
    const catalog = loadDemoCatalog();
    const published = catalog.articles.find((a) => a.slug === "getting-started-portal");
    const draftPeer = catalog.articles.find((a) => a.slug === "draft-guide");
    const hiddenPeer = catalog.articles.find((a) => a.slug === "hidden-guide");
    expect(published && draftPeer && hiddenPeer).toBeTruthy();

    const detail = buildArticleDetail(
      {
        ...published!,
        title: "Черновик заголовка",
        summary: "Черновик описания",
        blocks: [
          heading("d1", "Черновой раздел"),
          heading("d2", "Подраздел", 3),
        ],
        relatedArticleIds: [published!.relatedArticleIds[0]!, draftPeer!.id, hiddenPeer!.id],
        reviewDueAt: null,
      },
      catalog,
      now,
    );

    expect(detail.title).toBe("Черновик заголовка");
    expect(detail.tableOfContents.map((i) => i.text)).toEqual([
      "Черновой раздел",
      "Подраздел",
    ]);
    expect(detail.relatedMaterials.some((m) => m.slug === "draft-guide")).toBe(false);
    expect(detail.relatedMaterials.some((m) => m.slug === "hidden-guide")).toBe(false);
    expect(detail.relatedMaterials.some((m) => m.id === draftPeer!.id)).toBe(false);
    expect(detail.reviewStatus).toBeNull();
    expect(detail.metadata.tags.length).toBeGreaterThan(0);
    expect(detail.metadata.tags.every((t) => taxonomyCatalogHref("tag", t))).toBeTruthy();
    expect(JSON.stringify(detail.relatedMaterials)).not.toContain("storage.googleapis.com");
  });

  it("keeps archived taxonomy titles without filter hrefs", () => {
    const catalog = loadDemoCatalog();
    const published = catalog.articles.find((a) => a.slug === "getting-started-portal")!;
    const used = catalog.tags.find((t) => published.tagIds.includes(t.id))!;
    const tags = catalog.tags.map((t) =>
      t.id === used.id ? archiveTag(t, parseIsoDateTime(now)) : t,
    );
    const detail = buildArticleDetail(published, { ...catalog, tags }, now);
    const tag = detail.metadata.tags.find((t) => t.id === used.id);
    expect(tag?.title).toBe(used.title);
    expect(tag?.status).toBe("archived");
    expect(taxonomyCatalogHref("tag", tag!)).toBeNull();
    expect(detail.metadata.categories[0]?.title).toBeTruthy();
  });

  it("builds prompt preview with taxonomy and published related articles", () => {
    const catalog = loadDemoCatalog();
    const prompt = catalog.prompts.find((p) => p.slug === "demo-summarize-text")!;
    const draftArticle = catalog.articles.find((a) => a.slug === "draft-guide")!;
    const detail = buildPromptDetail(
      {
        ...prompt,
        promptText: "Новый текст промта",
        relatedArticleIds: [...prompt.relatedArticleIds, draftArticle.id],
      },
      catalog,
      now,
    );
    expect(detail.promptText).toBe("Новый текст промта");
    expect(detail.metadata.tags.length).toBeGreaterThan(0);
    expect(detail.relatedMaterials.some((m) => m.slug === "draft-guide")).toBe(false);
    expect(detail.relatedMaterials.every((m) => m.url.startsWith("/articles/"))).toBe(true);
  });

  it("omits missing optional taxonomy without throwing", () => {
    const catalog = loadDemoCatalog();
    const published = catalog.articles.find((a) => a.slug === "getting-started-portal")!;
    const detail = buildArticleDetail(
      {
        ...published,
        categoryIds: ["missing-category"],
        tagIds: ["missing-tag"],
        audienceIds: [],
      },
      catalog,
      now,
    );
    expect(detail.metadata.categories).toEqual([]);
    expect(detail.metadata.tags).toEqual([]);
    expect(detail.metadata.audiences).toEqual([]);
  });

  it("caps related materials at 6 unique published IDs", () => {
    const catalog = loadDemoCatalog();
    const published = catalog.articles.find((a) => a.slug === "getting-started-portal")!;
    const peers = catalog.articles.filter(
      (a) => a.status === "published" && a.id !== published.id,
    );
    const prompts = catalog.prompts.filter((p) => p.status === "published");
    const relatedArticleIds = [
      peers[0]!.id,
      peers[0]!.id,
      "missing-related",
      ...peers.map((a) => a.id),
    ];
    const relatedPromptIds = prompts.map((p) => p.id);
    const detail = buildArticleDetail(
      { ...published, relatedArticleIds, relatedPromptIds },
      catalog,
      now,
    );
    expect(detail.relatedMaterials.length).toBeLessThanOrEqual(6);
    const ids = detail.relatedMaterials.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("missing-related");
    expect(detail.relatedMaterials.every((m) => m.url.startsWith("/"))).toBe(true);
  });
});
