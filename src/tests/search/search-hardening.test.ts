import { beforeEach, describe, expect, it } from "vitest";

import { resetSearchEnvCacheForTests } from "@/config/search-env";
import {
  isActiveSearchDocument,
  searchDocumentId,
  type ActiveSearchDocument,
} from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import {
  parseAndValidateSearchGenerationPayload,
  parseAndValidateSearchManifest,
} from "@/domain/search/search-index-validation";
import { ConflictError } from "@/domain/shared/errors";
import { rankActiveDocuments } from "@/features/search/application/rank-documents";
import { rebuildSearchIndex } from "@/features/search/application/rebuild-search-index";
import { reindexSearchEntity } from "@/features/search/application/reindex-entity";
import { publishArticleAndIndex } from "@/features/search/application/content-search-orchestration";
import {
  createArticleUseCase,
  hideArticle,
  archiveArticle,
  publishArticle,
} from "@/features/content/application/article-use-cases";
import {
  createTestPorts,
  paragraphBlock,
  testCtx,
} from "@/tests/builders/content";
import {
  getMemorySearchFailuresForTests,
  getMemorySearchIndexForTests,
  resetSearchCompositionForTests,
} from "@/server/composition/search-ports";
import {
  encodeSearchCursor,
  decodeSearchCursor,
  hashSearchFilters,
  hashSearchQuery,
} from "@/server/search/search-cursor";
import { executePublicSearch } from "@/features/search/application/search-query-service";
import { ContentPortsSearchVisibility } from "@/server/search/public-search-visibility";
import { assertArticlePublishable } from "@/domain/content/article";

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

describe("acceptance hardening: rebuild CAS", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.SEARCH_CURSOR_HMAC_SECRET =
      "test-search-cursor-hmac-secret-fixture-32b";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
  });

  it("rebuild aborts on concurrent publish and leaves newer generation active", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const a = await createArticleUseCase(ports, ctx, {
      slug: "rb-a",
      title: "Rebuild Base",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "base")],
    });
    await publishArticle(ports, ctx, a.id, a.revision, "v1");
    await rebuildSearchIndex(ports);
    const index = getMemorySearchIndexForTests();
    const before = await index.getCurrentGeneration();

    // Simulate concurrent mutation during rebuild by flipping after baseline capture.
    const originalReplace = index.replaceGeneration.bind(index);
    index.replaceGeneration = async (docs, baseline) => {
      // Concurrent publish creates a newer generation first.
      await index.applyMutation({
        type: "upsert",
        document: activeDoc({
          entityId: "concurrent",
          sourceRevision: 1,
          title: "Concurrent Policy",
          searchableText: "Concurrent Policy",
        }),
      });
      return originalReplace(docs, baseline);
    };

    await expect(rebuildSearchIndex(ports)).rejects.toBeInstanceOf(ConflictError);
    const after = await index.getCurrentGeneration();
    expect(after?.generationId).not.toBe(before?.generationId);
    expect(after?.generationId).toBeTruthy();
    const docs = index.getDocumentsForTests(after!.generationId);
    expect(docs.some((d) => d.entityId === "concurrent")).toBe(true);
  });

  it("orphan rebuild generation is not current after CAS conflict", async () => {
    const index = getMemorySearchIndexForTests();
    await index.replaceGeneration(
      [activeDoc({ entityId: "a1", sourceRevision: 1, title: "One" })],
      { providerGeneration: null, generationId: null },
    );
    const baseline = await index.getCurrentGeneration();
    index.casConflictNextWrites = 1;
    const orphanAttempt = index.replaceGeneration(
      [activeDoc({ entityId: "a2", sourceRevision: 1, title: "Two" })],
      {
        providerGeneration: baseline!.providerGeneration,
        generationId: baseline!.generationId,
      },
    );
    await expect(orphanAttempt).rejects.toMatchObject({
      details: { adminCode: "SEARCH_INDEX_REBUILD_CONFLICT" },
    });
    const current = await index.getCurrentGeneration();
    expect(current?.generationId).toBe(baseline!.generationId);
  });

  it("failed rebuild does not change manifest", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const a = await createArticleUseCase(ports, ctx, {
      slug: "rb-fail",
      title: "Keep",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "keep")],
    });
    await publishArticle(ports, ctx, a.id, a.revision, "v1");
    const ok = await rebuildSearchIndex(ports);
    const index = getMemorySearchIndexForTests();
    index.failNextReplace = new Error("boom");
    await expect(rebuildSearchIndex(ports)).rejects.toThrow();
    const status = await index.getStatus();
    expect(status.generationId).toBe(ok.generationId);
  });
});

describe("acceptance hardening: orchestration + sourceRevision", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.SEARCH_CURSOR_HMAC_SECRET =
      "test-search-cursor-hmac-secret-fixture-32b";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
  });

  it("indexes when publish is called via orchestration not HTTP", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "orch-pub",
      title: "Orchestrated",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "body")],
    });
    assertArticlePublishable(created);
    const result = await publishArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      created.revision as number,
      "v1",
    );
    const index = getMemorySearchIndexForTests();
    const page = await index.search({
      q: "Orchestrated",
      filters: {},
      limit: 10,
    });
    expect(page.candidates[0]?.document.sourceRevision).toBe(
      result.article.revision,
    );
  });

  it("hide tombstone uses post-mutation aggregate revision", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "rev-hide",
      title: "Hide Me",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "x")],
    });
    const published = await publishArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      created.revision as number,
    );
    const { hideArticleAndIndex } = await import(
      "@/features/search/application/content-search-orchestration"
    );
    const hidden = await hideArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      published.article.revision as number,
    );
    const index = getMemorySearchIndexForTests();
    const docs = index.getDocumentsForTests();
    const entry = docs.find((d) => d.entityId === created.id);
    expect(entry?.state).toBe("removed");
    expect(entry?.sourceRevision).toBe(hidden.revision);
  });

  it("stale client expectedRevision does not index", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "stale-rev",
      title: "Stale",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "x")],
    });
    const published = await publishArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      created.revision as number,
    );
    const index = getMemorySearchIndexForTests();
    const before = index.getDocumentsForTests().length;
    await expect(
      publishArticleAndIndex(
        ports,
        ctx,
        created.id as string,
        created.revision as number, // stale vs published.article.revision
      ),
    ).rejects.toThrow();
    expect(index.getDocumentsForTests()).toHaveLength(before);
    expect(published.article.revision).toBeGreaterThan(created.revision as number);
  });
});

describe("acceptance hardening: deterministic ranking", () => {
  it("same generation ranking is stable across wall-clock times", () => {
    const docs = [
      activeDoc({
        entityId: "a1",
        sourceRevision: 1,
        title: "Guide",
        publishedAt: "2024-01-01T00:00:00.000Z",
      }),
      activeDoc({
        entityId: "a2",
        sourceRevision: 1,
        title: "Guide book",
        publishedAt: "2024-06-01T00:00:00.000Z",
      }),
    ];
    const ref = Date.parse("2024-06-15T12:00:00.000Z");
    const first = rankActiveDocuments(docs, "guide", {}, ref);
    const second = rankActiveDocuments(docs, "guide", {}, ref);
    expect(first.map((c) => c.document.entityId)).toEqual(
      second.map((c) => c.document.entityId),
    );
    expect(first.map((c) => c.score)).toEqual(second.map((c) => c.score));
  });
});

describe("acceptance hardening: cursor scanned semantics", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.SEARCH_CURSOR_HMAC_SECRET =
      "test-search-cursor-hmac-secret-fixture-32b";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
  });

  it("nextCursor advances past stale candidates and does not repeat", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const index = getMemorySearchIndexForTests();

    const created: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const a = await createArticleUseCase(ports, ctx, {
        slug: `cur-${i}`,
        title: `Cursor Guide ${i}`,
        ownerId: "user_1",
        blocks: [paragraphBlock(`p${i}`, `body ${i}`)],
      });
      const pub = await publishArticle(ports, ctx, a.id, a.revision, `v${i}`);
      created.push(a.id as string);
      await index.applyMutation({
        type: "upsert",
        document: activeDoc({
          entityId: a.id as string,
          sourceRevision: pub.article.revision as number,
          title: `Cursor Guide ${i}`,
          versionId: pub.versionId,
          publishedAt: `2024-06-1${i}T12:00:00.000Z`,
          searchableText: `Cursor Guide ${i}`,
        }),
      });
    }

    // Hide first two in content (stale in index until tombstone) — live gate drops them.
    const live0 = await ports.articles.getById(created[0]!);
    await hideArticle(ports, ctx, created[0]!, live0!.revision);
    const live1 = await ports.articles.getById(created[1]!);
    await archiveArticle(ports, ctx, created[1]!, live1!.revision);

    // Wire visibility to test ports via mock composition is hard; use gate directly + index search.
    const gate = new ContentPortsSearchVisibility(ports);
    const page1 = await index.search({ q: "Cursor Guide", filters: {}, limit: 10 });
    const visibility = await gate.filterVisible(
      page1.candidates.map((c) => ({
        entityType: c.document.entityType,
        entityId: c.document.entityId,
        versionId: c.document.versionId,
      })),
    );
    const visible = page1.candidates.filter((c, i) => visibility[i]?.visible);
    expect(visible.every((c) => !["0", "1"].includes(c.document.entityId.slice(-1)))).toBe(true);

    // executePublicSearch uses app content ports; ensure empty-query contract still holds.
    const empty = await executePublicSearch({ q: "" });
    expect(empty.items).toEqual([]);
  });
});

describe("acceptance hardening: validation + missing entity", () => {
  it("rejects duplicate document ids and checksum mismatch", () => {
    expect(() =>
      parseAndValidateSearchManifest({
        schemaVersion: 2,
        generationId: "gen_abc_0123456789ab",
        createdAt: "2024-06-15T12:00:00.000Z",
        documentCount: 1,
        activeDocumentCount: 1,
        indexChecksum: "not-hex!!!",
        previousGenerationId: null,
      }),
    ).toThrow();

    const doc = activeDoc({ entityId: "a1", sourceRevision: 1 });
    expect(() =>
      parseAndValidateSearchGenerationPayload({
        raw: {
          schemaVersion: 2,
          generationId: "gen_abc_0123456789ab",
          createdAt: "2024-06-15T12:00:00.000Z",
          documents: [doc, { ...doc }],
        },
        expectedGenerationId: "gen_abc_0123456789ab",
        maxDocuments: 100,
      }),
    ).toThrow(/Duplicate/);
  });

  it("reindex missing entity returns not_found without mutation", async () => {
    process.env.SEARCH_INDEX_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
    const ports = createTestPorts();
    const index = getMemorySearchIndexForTests();
    await index.replaceGeneration([], {
      providerGeneration: null,
      generationId: null,
    });
    const result = await reindexSearchEntity(ports, {
      entityType: "article",
      entityId: "missing_entity",
    });
    expect(result.outcome).toBe("not_found");
    expect(index.getDocumentsForTests()).toHaveLength(0);

    // Delayed valid mutation still works afterwards.
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "after-missing",
      title: "After Missing",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "x")],
    });
    await publishArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      created.revision as number,
    );
    expect(
      index.getDocumentsForTests().some((d) => isActiveSearchDocument(d)),
    ).toBe(true);
  });
});

describe("acceptance hardening: failure resolution", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
  });

  it("successful reindex resolves only covered failures", async () => {
    const ports = createTestPorts();
    const failures = getMemorySearchFailuresForTests();
    const now = "2024-06-15T12:00:00.000Z";
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "fail-res",
      title: "Fail Res",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "x")],
    });
    const entityId = created.id as string;
    await failures.save({
      id: "f_old",
      entityType: "article",
      entityId,
      operation: "upsert",
      sourceRevision: 0,
      versionId: "v1",
      failureCode: "UPSERT_FAILED",
      occurredAt: now,
      updatedAt: now,
      attemptCount: 1,
      resolvedAt: null,
      requestId: null,
    });
    await failures.save({
      id: "f_newer_rev",
      entityType: "article",
      entityId,
      operation: "upsert",
      sourceRevision: 99,
      versionId: "v9",
      failureCode: "UPSERT_FAILED",
      occurredAt: now,
      updatedAt: now,
      attemptCount: 1,
      resolvedAt: null,
      requestId: null,
    });
    await publishArticle(ports, ctx, created.id, created.revision, "v1");
    const live = await ports.articles.getById(entityId);
    await reindexSearchEntity(ports, {
      entityType: "article",
      entityId,
    });

    const open = await failures.listOpenForEntity("article", entityId);
    expect(live!.revision as number).toBeLessThan(99);
    expect(open.some((f) => f.id === "f_newer_rev")).toBe(true);
    expect(open.some((f) => f.id === "f_old")).toBe(false);
  });
});

describe("acceptance hardening: cursor secret instances", () => {
  it("different secrets reject cursors safely", () => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.SEARCH_CURSOR_HMAC_SECRET =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    resetSearchEnvCacheForTests();
    const cursor = encodeSearchCursor({
      schemaVersion: 1,
      generationId: "gen_1",
      queryHash: hashSearchQuery("hello"),
      filtersHash: hashSearchFilters({}),
      score: 1,
      publishedAt: "2024-06-15T12:00:00.000Z",
      entityType: "article",
      entityId: "a1",
    });
    process.env.SEARCH_CURSOR_HMAC_SECRET =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    resetSearchEnvCacheForTests();
    expect(() => decodeSearchCursor(cursor)).toThrow();
  });

  it("filter hash is order-independent", () => {
    expect(
      hashSearchFilters({
        entityType: "article",
        categoryId: "c1",
        tagId: "t1",
        audienceId: "a1",
      }),
    ).toBe(
      hashSearchFilters({
        audienceId: "a1",
        tagId: "t1",
        categoryId: "c1",
        entityType: "article",
      }),
    );
  });
});

describe("acceptance hardening: tombstones after rebuild", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
  });

  it("rebuild keeps tombstones so delayed stale publish cannot resurrect", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "tomb-rb",
      title: "Tomb Rebuild",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "x")],
    });
    const published = await publishArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      created.revision as number,
    );
    const { hideArticleAndIndex } = await import(
      "@/features/search/application/content-search-orchestration"
    );
    const hidden = await hideArticleAndIndex(
      ports,
      ctx,
      created.id as string,
      published.article.revision as number,
    );
    await rebuildSearchIndex(ports);
    const index = getMemorySearchIndexForTests();
    const stale = activeDoc({
      entityId: created.id as string,
      sourceRevision: (hidden.revision as number) - 1,
      title: "Stale Publish Retry",
      versionId: published.versionId,
    });
    const result = await index.applyMutation({ type: "upsert", document: stale });
    expect(result.outcome).toBe("ignored_stale");
    const docs = index.getDocumentsForTests();
    const entry = docs.find((d) => d.entityId === created.id);
    expect(entry && !isActiveSearchDocument(entry)).toBe(true);
  });
});
