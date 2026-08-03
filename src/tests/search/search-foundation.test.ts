import { describe, expect, it, beforeEach } from "vitest";

import { resetSearchEnvCacheForTests } from "@/config/search-env";
import {
  createSearchTombstone,
  resolveSearchMutation,
  searchDocumentId,
} from "@/domain/search/search-document";
import {
  normalizeSearchQuery,
  tokenizeSearchQuery,
} from "@/domain/search/text-normalize";
import { MemorySearchIndexAdapter } from "@/server/repositories/memory/memory-search-index";
import type { ActiveSearchDocument } from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import { rankActiveDocuments } from "@/features/search/application/rank-documents";
import {
  encodeSearchCursor,
  decodeSearchCursor,
  hashSearchQuery,
  hashSearchFilters,
} from "@/server/search/search-cursor";
import { ConflictError } from "@/domain/shared/errors";

function activeDoc(
  overrides: Partial<ActiveSearchDocument> & {
    entityId: string;
    sourceRevision: number;
  },
): ActiveSearchDocument {
  const entityId = overrides.entityId;
  return {
    id: searchDocumentId("article", entityId),
    entityType: "article",
    entityId,
    sourceRevision: overrides.sourceRevision,
    versionId: overrides.versionId ?? `ver_${entityId}`,
    versionNumber: overrides.versionNumber ?? 1,
    state: "active",
    slug: overrides.slug ?? entityId,
    href: overrides.href ?? `/articles/${entityId}`,
    title: overrides.title ?? "Title",
    summary: overrides.summary ?? "Summary",
    bodyText: overrides.bodyText ?? "Body text content",
    promptText: null,
    headings: overrides.headings ?? ["Heading"],
    categoryIds: overrides.categoryIds ?? [],
    tagIds: overrides.tagIds ?? [],
    audienceIds: overrides.audienceIds ?? [],
    publishedAt: overrides.publishedAt ?? "2024-06-15T12:00:00.000Z",
    searchableText: overrides.searchableText ?? "Title Summary Body text content",
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
  };
}

describe("search foundation domain", () => {
  it("normalizes and tokenizes queries", () => {
    expect(normalizeSearchQuery("  Foo\u00A0BAR  ")).toBe("foo bar");
    expect(tokenizeSearchQuery("Hello, мир!")).toEqual(["hello", "мир"]);
  });

  it("applies revision guards", () => {
    const existing = activeDoc({ entityId: "a1", sourceRevision: 2 });
    const stale = activeDoc({
      entityId: "a1",
      sourceRevision: 1,
      title: "Old",
    });
    expect(resolveSearchMutation(existing, stale).outcome).toBe("ignored_stale");

    const same = activeDoc({ entityId: "a1", sourceRevision: 2 });
    expect(resolveSearchMutation(existing, same).outcome).toBe("idempotent");

    const conflict = activeDoc({
      entityId: "a1",
      sourceRevision: 2,
      title: "Different",
    });
    expect(resolveSearchMutation(existing, conflict).outcome).toBe("conflict");

    const newer = activeDoc({ entityId: "a1", sourceRevision: 3 });
    expect(resolveSearchMutation(existing, newer).outcome).toBe("applied");
  });

  it("tombstone blocks stale publish resurrection", () => {
    const tombstone = createSearchTombstone({
      entityType: "article",
      entityId: "a1",
      sourceRevision: 5,
    });
    const stalePublish = activeDoc({ entityId: "a1", sourceRevision: 4 });
    expect(resolveSearchMutation(tombstone, stalePublish).outcome).toBe(
      "ignored_stale",
    );
    const republish = activeDoc({ entityId: "a1", sourceRevision: 6 });
    expect(resolveSearchMutation(tombstone, republish).outcome).toBe("applied");
  });
});

describe("memory search index", () => {
  let index: MemorySearchIndexAdapter;

  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    resetSearchEnvCacheForTests();
    index = new MemorySearchIndexAdapter();
  });

  it("upserts hide and ignores stale publish", async () => {
    const doc = activeDoc({ entityId: "a1", sourceRevision: 1, title: "Alpha" });
    await index.applyMutation({ type: "upsert", document: doc });
    const tombstone = createSearchTombstone({
      entityType: "article",
      entityId: "a1",
      sourceRevision: 2,
    });
    await index.applyMutation({ type: "remove", document: tombstone });
    const stale = activeDoc({ entityId: "a1", sourceRevision: 1, title: "Alpha" });
    const result = await index.applyMutation({ type: "upsert", document: stale });
    expect(result.outcome).toBe("ignored_stale");
    const status = await index.getStatus();
    const docs = index.getDocumentsForTests(status.generationId!);
    expect(docs[0]?.state).toBe("removed");
  });

  it("ranks exact title above body", async () => {
    await index.replaceGeneration([
      activeDoc({
        entityId: "a1",
        sourceRevision: 1,
        title: "Policy",
        bodyText: "other",
        searchableText: "Policy other",
      }),
      activeDoc({
        entityId: "a2",
        sourceRevision: 1,
        title: "Other",
        bodyText: "policy handbook",
        searchableText: "Other policy handbook",
        publishedAt: "2024-01-01T00:00:00.000Z",
      }),
    ], { providerGeneration: null, generationId: null });
    const page = await index.search({
      q: "policy",
      filters: {},
      limit: 10,
    });
    expect(page.candidates[0]?.document.entityId).toBe("a1");
  });

  it("paginates with deterministic order", async () => {
    await index.replaceGeneration([
      activeDoc({ entityId: "a1", sourceRevision: 1, title: "Guide one" }),
      activeDoc({ entityId: "a2", sourceRevision: 1, title: "Guide two" }),
      activeDoc({ entityId: "a3", sourceRevision: 1, title: "Guide three" }),
    ], { providerGeneration: null, generationId: null });
    const first = await index.search({ q: "guide", filters: {}, limit: 2 });
    expect(first.candidates).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const last = first.candidates[1]!;
    const second = await index.search({
      q: "guide",
      filters: {},
      limit: 2,
      after: {
        score: last.score,
        publishedAt: last.document.publishedAt,
        entityType: last.document.entityType,
        entityId: last.document.entityId,
      },
      generationId: first.generationId,
    });
    expect(second.candidates.length).toBeGreaterThan(0);
    expect(second.candidates[0]?.document.entityId).not.toBe(
      first.candidates[0]?.document.entityId,
    );
  });

  it("filters by categoryId", async () => {
    await index.replaceGeneration([
      activeDoc({
        entityId: "a1",
        sourceRevision: 1,
        title: "Cat match",
        categoryIds: ["cat_1"],
      }),
      activeDoc({
        entityId: "a2",
        sourceRevision: 1,
        title: "Cat other",
        categoryIds: ["cat_2"],
      }),
    ], { providerGeneration: null, generationId: null });
    const page = await index.search({
      q: "cat",
      filters: { categoryId: "cat_1" },
      limit: 10,
    });
    expect(page.candidates.map((c) => c.document.entityId)).toEqual(["a1"]);
  });

  it("raises conflict on equal revision payload mismatch", async () => {
    const doc = activeDoc({ entityId: "a1", sourceRevision: 1 });
    await index.applyMutation({ type: "upsert", document: doc });
    await expect(
      index.applyMutation({
        type: "upsert",
        document: activeDoc({
          entityId: "a1",
          sourceRevision: 1,
          title: "Changed",
        }),
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("search cursor", () => {
  it("round-trips integrity-protected cursor", () => {
    const payload = {
      schemaVersion: 1 as const,
      generationId: "gen_1",
      queryHash: hashSearchQuery("hello"),
      filtersHash: hashSearchFilters({}),
      score: 10,
      publishedAt: "2024-06-15T12:00:00.000Z",
      entityType: "article" as const,
      entityId: "a1",
    };
    const encoded = encodeSearchCursor(payload);
    expect(decodeSearchCursor(encoded)).toEqual(payload);
  });

  it("rejects tampered cursor", () => {
    expect(() => decodeSearchCursor("abc.def")).toThrow();
  });
});

describe("rankActiveDocuments", () => {
  it("returns empty for empty query tokens", () => {
    expect(
      rankActiveDocuments(
        [activeDoc({ entityId: "a1", sourceRevision: 1 })],
        " ",
        {},
        Date.parse("2024-06-15T12:00:00.000Z"),
      ),
    ).toEqual([]);
  });
});
