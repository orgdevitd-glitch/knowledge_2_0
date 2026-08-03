import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSearchEnvCacheForTests } from "@/config/search-env";
import {
  searchDocumentId,
  type ActiveSearchDocument,
} from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION, SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { executeSearchSuggestions } from "@/features/search/application/suggestions-service";
import {
  getMemorySearchIndexForTests,
  resetSearchCompositionForTests,
} from "@/server/composition/search-ports";

const visibilityMock = vi.fn();

vi.mock("@/server/composition/search-ports", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/composition/search-ports")
  >("@/server/composition/search-ports");
  return {
    ...actual,
    getPublicSearchVisibility: () => ({
      filterVisible: visibilityMock,
    }),
  };
});

vi.mock("@/features/search/application/taxonomy-display", () => ({
  loadSearchTaxonomyMaps: vi.fn(async () => ({
    selectable: {
      categories: [
        { id: "cat_active", title: "Alpha Category", status: "active" as const },
      ],
      tags: [{ id: "tag_active", title: "Alpha tag", status: "active" as const }],
      audiences: [
        { id: "aud_active", title: "All staff", status: "active" as const },
      ],
    },
    display: {
      categories: new Map(),
      tags: new Map(),
      audiences: new Map(),
    },
    guidedCategories: [],
  })),
}));

function activeDoc(
  overrides: Partial<ActiveSearchDocument> & { entityId: string; title: string },
): ActiveSearchDocument {
  const entityId = overrides.entityId;
  return {
    id: searchDocumentId("article", entityId),
    entityType: "article",
    entityId,
    sourceRevision: overrides.sourceRevision ?? 1,
    versionId: overrides.versionId ?? `ver_${entityId}`,
    versionNumber: 1,
    state: "active",
    slug: overrides.slug ?? entityId,
    href: overrides.href ?? `/articles/${entityId}`,
    title: overrides.title,
    summary: "Summary",
    bodyText: "Body",
    promptText: null,
    headings: [],
    categoryIds: overrides.categoryIds ?? [],
    tagIds: overrides.tagIds ?? [],
    audienceIds: overrides.audienceIds ?? [],
    publishedAt: "2024-06-15T12:00:00.000Z",
    searchableText: overrides.title,
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
  };
}

async function seed(docs: ActiveSearchDocument[]) {
  const index = getMemorySearchIndexForTests();
  for (const document of docs) {
    await index.applyMutation({ type: "upsert", document });
  }
}

describe("executeSearchSuggestions", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.PERSISTENCE_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
    visibilityMock.mockImplementation(async (items: { entityId: string; entityType: string }[]) =>
      items.map((i) => ({ ...i, visible: true })),
    );
  });

  it("returns empty for short prefix", async () => {
    const result = await executeSearchSuggestions({ q: "a" });
    expect(result.status).toBe("empty");
    expect(result.items).toEqual([]);
  });

  it("orders exact title match first then taxonomy kinds", async () => {
    await seed([
      activeDoc({ entityId: "1", title: "Alphabet Soup" }),
      activeDoc({ entityId: "2", title: "Al" }),
      activeDoc({ entityId: "3", title: "Alpha Guide" }),
    ]);

    const result = await executeSearchSuggestions({ q: "al" });
    expect(result.status).toBe("ok");
    const titles = result.items.filter((i) => i.kind === "title");
    expect(titles[0]?.label).toBe("Al");
    expect(titles.map((t) => t.href)).toEqual([
      "/articles/2",
      "/articles/3",
      "/articles/1",
    ]);
    const afterTitles = result.items.slice(titles.length);
    expect(afterTitles.map((i) => i.kind)).toEqual([
      "category",
      "tag",
      "audience",
    ]);
    expect(result.items.length).toBeLessThanOrEqual(
      SEARCH_LIMIT_DEFAULTS.suggestionsMaxItems,
    );
    expect(JSON.stringify(result.items)).not.toMatch(/versionId|generationId|bodyText/);
  });

  it("excludes non-visible title suggestions", async () => {
    await seed([activeDoc({ entityId: "h1", title: "Alchemy" })]);
    visibilityMock.mockResolvedValue([
      { entityType: "article", entityId: "h1", visible: false },
    ]);
    const result = await executeSearchSuggestions({ q: "alc" });
    expect(result.items.filter((i) => i.kind === "title")).toEqual([]);
  });

  it("still returns taxonomy when index empty", async () => {
    const result = await executeSearchSuggestions({ q: "alp" });
    expect(
      result.items.some(
        (i) => i.kind === "category" && i.label === "Alpha Category",
      ),
    ).toBe(true);
    expect(result.items.every((i) => i.kind !== "title")).toBe(true);
  });

  it("respects type filter for titles", async () => {
    await seed([activeDoc({ entityId: "a1", title: "Alpha Article" })]);
    const result = await executeSearchSuggestions({ q: "alp", type: "prompt" });
    expect(result.items.filter((i) => i.kind === "title")).toEqual([]);
  });
});
