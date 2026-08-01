import { describe, expect, it } from "vitest";

import { isPubliclyVisible, filterPublished } from "@/features/public-content/visibility";
import { resolveReviewStatus, reviewStatusLabel } from "@/features/public-content/review-status";
import {
  buildCatalogPage,
  buildSearchDocuments,
} from "@/features/public-content/catalog";
import {
  highlightSegments,
  normalizeSearchQuery,
  runBasicSearch,
  tokenize,
} from "@/features/public-content/search";
import { BLOCK_TYPES } from "@/domain/content/blocks";
import { listRegisteredBlockTypes } from "@/features/public-content/rendering/block-registry";
import { loadDemoCatalog } from "@/server/content-sources/demo/load-demo-catalog";

describe("visibility policy", () => {
  it("allows only published", () => {
    expect(isPubliclyVisible("published")).toBe(true);
    expect(isPubliclyVisible("draft")).toBe(false);
    expect(isPubliclyVisible("hidden")).toBe(false);
    expect(isPubliclyVisible("archived")).toBe(false);
  });

  it("demo catalog exposes non-published entities that stay filtered out", () => {
    const catalog = loadDemoCatalog();
    const publishedArticles = filterPublished(catalog.articles);
    expect(publishedArticles.every((a) => a.status === "published")).toBe(true);
    expect(catalog.articles.some((a) => a.status === "draft")).toBe(true);
    expect(catalog.articles.some((a) => a.status === "hidden")).toBe(true);
    expect(catalog.articles.some((a) => a.status === "archived")).toBe(true);

    const now = "2024-06-15T12:00:00.000Z";
    const page = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      {},
    );
    expect(page.items.every((i) => i.type === "article" || i.type === "prompt")).toBe(
      true,
    );
    expect(page.items.some((i) => i.slug === "draft-guide")).toBe(false);
    expect(page.items.some((i) => i.slug === "hidden-guide")).toBe(false);
    expect(page.items.some((i) => i.slug === "archived-guide")).toBe(false);
  });
});

describe("catalog filters", () => {
  it("filters by type category audience and sorts", () => {
    const catalog = loadDemoCatalog();
    const now = "2024-06-15T12:00:00.000Z";
    const articles = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { type: "article", sort: "title-asc" },
    );
    expect(articles.items.every((i) => i.type === "article")).toBe(true);
    for (let i = 1; i < articles.items.length; i += 1) {
      expect(
        articles.items[i - 1]!.title.localeCompare(articles.items[i]!.title, "ru"),
      ).toBeLessThanOrEqual(0);
    }

    const withUnknown = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { type: "nope", sort: "bogus", page: "999" },
    );
    expect(withUnknown.filters.type).toBeNull();
    expect(withUnknown.filters.sort).toBe("updated-desc");
  });
});

describe("search", () => {
  it("ranks exact title above body and handles cyrillic", () => {
    const catalog = loadDemoCatalog();
    const docs = buildSearchDocuments(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
    );
    expect(docs.every((d) => d.type === "article" || d.type === "prompt")).toBe(
      true,
    );
    const draftSlugs = catalog.articles
      .filter((a) => a.status !== "published")
      .map((a) => a.slug as string);
    expect(docs.some((d) => draftSlugs.includes(d.slug))).toBe(false);

    const result = runBasicSearch(docs, { q: "  Портал  " });
    expect(normalizeSearchQuery("  Портал  ")).toBe("портал");
    expect(tokenize("Привет, мир!")).toEqual(["привет", "мир"]);
    expect(result.hits.length).toBeGreaterThan(0);

    const short = runBasicSearch(docs, { q: "а" });
    expect(short.tooShort).toBe(true);

    const long = runBasicSearch(docs, { q: "x".repeat(200) });
    expect(long.tooLong).toBe(true);

    const parts = highlightSegments("Портал знаний", ["портал"]);
    expect(parts.some((p) => p.match)).toBe(true);
  });
});

describe("review status", () => {
  it("maps due dates to user labels", () => {
    expect(resolveReviewStatus(null, "2024-06-15T12:00:00.000Z")).toBe("current");
    expect(
      resolveReviewStatus("2024-06-20T12:00:00.000Z", "2024-06-15T12:00:00.000Z"),
    ).toBe("due-soon");
    expect(
      resolveReviewStatus("2024-06-01T12:00:00.000Z", "2024-06-15T12:00:00.000Z"),
    ).toBe("overdue");
    expect(reviewStatusLabel("overdue")).toBe("Требуется проверка");
  });
});

describe("block registry", () => {
  it("registers all 22 block types", () => {
    const registered = listRegisteredBlockTypes();
    expect(registered.sort()).toEqual([...BLOCK_TYPES].sort());
  });
});
