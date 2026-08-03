import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSearchEnvCacheForTests } from "@/config/search-env";
import {
  searchDocumentId,
  type ActiveSearchDocument,
} from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
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
        { id: "cat_a", title: "Alpha Category", status: "active" as const },
      ],
      tags: [{ id: "tag_a", title: "Alpha tag", status: "active" as const }],
      audiences: [
        { id: "aud_a", title: "All staff", status: "active" as const },
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
  overrides: Partial<ActiveSearchDocument> & {
    entityId: string;
    title: string;
    entityType?: "article" | "prompt";
  },
): ActiveSearchDocument {
  const entityType = overrides.entityType ?? "article";
  const entityId = overrides.entityId;
  return {
    id: searchDocumentId(entityType, entityId),
    entityType,
    entityId,
    sourceRevision: 1,
    versionId: `ver_${entityId}`,
    versionNumber: 1,
    state: "active",
    slug: overrides.slug ?? entityId,
    href: overrides.href ?? `/${entityType === "article" ? "articles" : "prompts"}/${entityId}`,
    title: overrides.title,
    summary: "Summary",
    bodyText: "Body",
    promptText: entityType === "prompt" ? "prompt body" : null,
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

describe("suggestions content filters", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.PERSISTENCE_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
    visibilityMock.mockImplementation(
      async (items: { entityId: string; entityType: string }[]) =>
        items.map((i) => ({ ...i, visible: true })),
    );
  });

  it("type=prompt excludes Article title suggestions", async () => {
    await seed([
      activeDoc({ entityId: "a1", title: "Alpha Article", entityType: "article" }),
      activeDoc({ entityId: "p1", title: "Alpha Prompt", entityType: "prompt" }),
    ]);
    const result = await executeSearchSuggestions({ q: "alp", type: "prompt" });
    const titles = result.items.filter((i) => i.kind === "title");
    expect(titles.every((t) => t.entityType === "prompt")).toBe(true);
    expect(titles.map((t) => t.label)).toContain("Alpha Prompt");
    expect(titles.map((t) => t.label)).not.toContain("Alpha Article");
  });

  it("type=article excludes Prompt title suggestions", async () => {
    await seed([
      activeDoc({ entityId: "a1", title: "Alpha Article", entityType: "article" }),
      activeDoc({ entityId: "p1", title: "Alpha Prompt", entityType: "prompt" }),
    ]);
    const result = await executeSearchSuggestions({ q: "alp", type: "article" });
    const titles = result.items.filter((i) => i.kind === "title");
    expect(titles.every((t) => t.entityType === "article")).toBe(true);
  });

  it("applies category/tag/audience filters before limit", async () => {
    await seed([
      activeDoc({
        entityId: "1",
        title: "Alpha One",
        categoryIds: ["cat_a"],
        tagIds: ["tag_a"],
        audienceIds: ["aud_a"],
      }),
      activeDoc({
        entityId: "2",
        title: "Alpha Two",
        categoryIds: ["other"],
      }),
    ]);
    const result = await executeSearchSuggestions({
      q: "alp",
      category: "cat_a",
      tag: "tag_a",
      audience: "aud_a",
    });
    const titles = result.items.filter((i) => i.kind === "title");
    expect(titles.map((t) => t.label)).toEqual(["Alpha One"]);
  });

  it("combined filters with no matches return empty titles without 500", async () => {
    await seed([
      activeDoc({ entityId: "1", title: "Alpha", categoryIds: ["cat_a"] }),
    ]);
    const result = await executeSearchSuggestions({
      q: "alp",
      category: "missing_cat",
    });
    expect(result.items.filter((i) => i.kind === "title")).toEqual([]);
    expect(result.status === "ok" || result.status === "empty").toBe(true);
  });

  it("invalid taxonomy ID does not throw", async () => {
    await expect(
      executeSearchSuggestions({
        q: "alp",
        category: "unknown_id_xyz",
        tag: "also_unknown",
      }),
    ).resolves.toMatchObject({ incomplete: expect.any(Boolean) });
  });

  it("excludes unsafe href titles fail-closed", async () => {
    await seed([
      activeDoc({
        entityId: "bad",
        title: "Alpha Bad",
        href: "https://evil.example/x",
      }),
      activeDoc({ entityId: "good", title: "Alpha Good" }),
    ]);
    const result = await executeSearchSuggestions({ q: "alp" });
    const titles = result.items.filter((i) => i.kind === "title");
    expect(titles.map((t) => t.label)).toEqual(["Alpha Good"]);
  });

  it("taxonomy suggestions remain available regardless of content type filter", async () => {
    const result = await executeSearchSuggestions({
      q: "alp",
      type: "prompt",
    });
    expect(result.items.some((i) => i.kind === "category")).toBe(true);
    expect(result.items.some((i) => i.kind === "tag")).toBe(true);
  });
});
