import { describe, expect, it } from "vitest";

import { archiveTag } from "@/domain/content/taxonomy";
import { parseIsoDateTime } from "@/domain/shared/value-objects";
import { buildCatalogPage } from "@/features/public-content/catalog";
import { loadDemoCatalog } from "@/server/content-sources/demo/load-demo-catalog";

const now = "2024-06-15T12:00:00.000Z";

describe("catalog tag filter", () => {
  it("filters by tag slug and keeps category combinations", () => {
    const catalog = loadDemoCatalog();
    const tagged = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { tag: "demo-onboarding" },
    );
    expect(tagged.filters.tag).toBe("demo-onboarding");
    expect(tagged.items.length).toBeGreaterThan(0);
    expect(tagged.items.every((i) => i.tags.some((t) => t.slug === "demo-onboarding"))).toBe(
      true,
    );
    expect(tagged.tagOptions.some((o) => o.slug === "demo-onboarding")).toBe(true);

    const combined = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { category: "demo-guides", tag: "demo-onboarding" },
    );
    expect(combined.filters.category).toBe("demo-guides");
    expect(combined.filters.tag).toBe("demo-onboarding");
    expect(
      combined.items.every(
        (i) =>
          i.category?.slug === "demo-guides" &&
          i.tags.some((t) => t.slug === "demo-onboarding"),
      ),
    ).toBe(true);
  });

  it("does not treat a tag slug as a category", () => {
    const catalog = loadDemoCatalog();
    const page = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { category: "demo-onboarding" },
    );
    expect(page.filters.category).toBe("demo-onboarding");
    expect(page.items).toHaveLength(0);
  });

  it("keeps unknown but safe tag in state and returns no items", () => {
    const catalog = loadDemoCatalog();
    const page = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { tag: "no-such-tag" },
    );
    expect(page.filters.tag).toBe("no-such-tag");
    expect(page.total).toBe(0);
  });

  it("drops unsafe tag values", () => {
    const catalog = loadDemoCatalog();
    const page = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { tag: "https://evil.example" },
    );
    expect(page.filters.tag).toBeNull();
  });

  it("includes archived tags with published usage as legacy options", () => {
    const catalog = loadDemoCatalog();
    const used = catalog.tags.find((t) => t.slug === "demo-onboarding");
    expect(used).toBeTruthy();
    const archived = archiveTag(used!, parseIsoDateTime(now));
    const tags = catalog.tags.map((t) => (t.id === archived.id ? archived : t));
    const page = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      tags,
      catalog.audiences,
      now,
      {},
    );
    expect(page.tagOptions.some((o) => o.slug === "demo-onboarding")).toBe(true);
    const item = page.items.find((i) => i.tags.some((t) => t.slug === "demo-onboarding"));
    expect(item?.tags.find((t) => t.slug === "demo-onboarding")?.status).toBe("archived");
  });

  it("keeps published materials for an archived tag direct URL", () => {
    const catalog = loadDemoCatalog();
    const used = catalog.tags.find((t) => t.slug === "demo-onboarding")!;
    const tags = catalog.tags.map((t) =>
      t.id === used.id ? archiveTag(t, parseIsoDateTime(now)) : t,
    );
    const page = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      tags,
      catalog.audiences,
      now,
      { tag: "demo-onboarding" },
    );
    expect(page.filters.tag).toBe("demo-onboarding");
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((i) => i.tags.some((t) => t.slug === "demo-onboarding"))).toBe(
      true,
    );
  });

  it("returns an empty catalog for unknown but safe category and audience slugs", () => {
    const catalog = loadDemoCatalog();
    const category = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { category: "no-such-category" },
    );
    expect(category.filters.category).toBe("no-such-category");
    expect(category.total).toBe(0);

    const audience = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { audience: "no-such-audience" },
    );
    expect(audience.filters.audience).toBe("no-such-audience");
    expect(audience.total).toBe(0);
  });

  it("keeps combined allowlisted filters including type, q, audience, and sort", () => {
    const catalog = loadDemoCatalog();
    const typeAndTag = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { type: "article", tag: "demo-onboarding" },
    );
    expect(typeAndTag.filters.type).toBe("article");
    expect(typeAndTag.filters.tag).toBe("demo-onboarding");
    expect(typeAndTag.items.every((i) => i.type === "article")).toBe(true);

    const qAndTag = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { q: "портал", tag: "demo-onboarding" },
    );
    expect(qAndTag.filters.q).toBe("портал");
    expect(qAndTag.filters.tag).toBe("demo-onboarding");

    const audienceAndCategory = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { category: "demo-guides", audience: "demo-all-staff" },
    );
    expect(audienceAndCategory.filters.category).toBe("demo-guides");
    expect(audienceAndCategory.filters.audience).toBe("demo-all-staff");

    const tagAndSort = buildCatalogPage(
      catalog.articles,
      catalog.prompts,
      catalog.categories,
      catalog.tags,
      catalog.audiences,
      now,
      { tag: "demo-onboarding", sort: "title-asc" },
    );
    expect(tagAndSort.filters.sort).toBe("title-asc");
    expect(tagAndSort.filters.tag).toBe("demo-onboarding");
  });
});
