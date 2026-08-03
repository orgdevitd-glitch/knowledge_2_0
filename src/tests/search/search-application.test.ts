import { beforeEach, describe, expect, it } from "vitest";

import { resetSearchEnvCacheForTests } from "@/config/search-env";
import { toArticleSnapshot } from "@/domain/content/article";
import { toPromptSnapshot } from "@/domain/content/prompt";
import {
  buildArticleSearchDocument,
  buildPromptSearchDocument,
} from "@/features/search/application/build-search-document";
import {
  indexAfterArticleRemoval,
  indexAfterArticlePublish,
} from "@/features/search/application/indexing-service";
import { rebuildSearchIndex } from "@/features/search/application/rebuild-search-index";
import { executePublicSearch } from "@/features/search/application/search-query-service";
import {
  createArticleUseCase,
  hideArticle,
  publishArticle,
} from "@/features/content/application/article-use-cases";
import {
  createPromptUseCase,
  publishPrompt,
} from "@/features/content/application/prompt-use-cases";
import {
  createTestPorts,
  headingBlock,
  paragraphBlock,
  testCtx,
} from "@/tests/builders/content";
import {
  getMemorySearchIndexForTests,
  resetSearchCompositionForTests,
} from "@/server/composition/search-ports";
import { ContentPortsSearchVisibility } from "@/server/search/public-search-visibility";
import { isActiveSearchDocument } from "@/domain/search/search-document";

describe("search indexing application", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.PERSISTENCE_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
  });

  it("builds SearchDocument from published snapshot not live draft text", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "search-snap",
      title: "Published Title",
      ownerId: "user_1",
      blocks: [
        headingBlock("h1", "Pub Heading"),
        paragraphBlock("p1", "Pub body"),
      ],
    });
    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    const version = await ports.versions.getById(published.versionId);
    const doc = buildArticleSearchDocument({
      live: published.article,
      snapshot: version!.snapshot as ReturnType<typeof toArticleSnapshot>,
      versionId: published.versionId,
      versionNumber: 1,
    });
    expect(doc.title).toBe("Published Title");
    expect(doc.headings).toContain("Pub Heading");
    expect(doc.bodyText).toMatch(/Pub body/);
    expect(JSON.stringify(doc)).not.toMatch(/user_1/);
    expect(() =>
      buildArticleSearchDocument({
        live: published.article,
        snapshot: version!.snapshot as ReturnType<typeof toArticleSnapshot>,
        versionId: "wrong_version",
        versionNumber: 1,
      }),
    ).toThrow();
  });

  it("indexes after publish and tombstones on hide", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "search-hide",
      title: "Visible Policy",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "policy body")],
    });
    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    await indexAfterArticlePublish({
      ports,
      articleId: created.id as string,
      versionId: published.versionId,
    });

    const index = getMemorySearchIndexForTests();
    const page = await index.search({
      q: "Visible Policy",
      filters: {},
      limit: 10,
    });
    expect(page.candidates[0]?.document.entityId).toBe(created.id);
    expect(page.candidates[0]?.document).not.toHaveProperty("ownerId");

    const gate = new ContentPortsSearchVisibility(ports);
    const visible = await gate.filterVisible(
      page.candidates.map((c) => ({
        entityType: c.document.entityType,
        entityId: c.document.entityId,
        versionId: c.document.versionId,
      })),
    );
    expect(visible.every((v) => v.visible)).toBe(true);

    const hidden = await hideArticle(
      ports,
      ctx,
      created.id,
      published.article.revision,
    );
    await indexAfterArticleRemoval({
      ports,
      articleId: created.id as string,
    });

    const status = await index.getStatus();
    const docs = index.getDocumentsForTests(status.generationId!);
    const entry = docs.find((d) => d.entityId === created.id);
    expect(entry && !isActiveSearchDocument(entry)).toBe(true);

    const after = await gate.filterVisible([
      {
        entityType: "article",
        entityId: created.id as string,
        versionId: published.versionId,
      },
    ]);
    expect(after[0]?.visible).toBe(false);
    expect(hidden.status).toBe("hidden");
  });

  it("rebuild scans beyond first page without silent 100 cap", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    for (let i = 0; i < 12; i += 1) {
      const created = await createArticleUseCase(ports, ctx, {
        slug: `rebuild-${i}`,
        title: `Rebuild Doc ${i}`,
        ownerId: "user_1",
        blocks: [paragraphBlock(`p${i}`, `content ${i}`)],
      });
      await publishArticle(ports, ctx, created.id, created.revision, `v${i}`);
    }
    const originalList = ports.articles.list.bind(ports.articles);
    let pages = 0;
    ports.articles.list = async (filters, pagination) => {
      pages += 1;
      return originalList(filters, { ...pagination, limit: 5 });
    };

    const result = await rebuildSearchIndex(ports);
    expect(pages).toBeGreaterThan(1);
    expect(result.activeDocumentCount).toBe(12);
    expect(result.scannedArticles).toBe(12);
  });

  it("visibility port drops version mismatch and missing entities", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "vis-gate",
      title: "Gate",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "gate")],
    });
    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    const gate = new ContentPortsSearchVisibility(ports);
    const results = await gate.filterVisible([
      {
        entityType: "article",
        entityId: created.id as string,
        versionId: published.versionId,
      },
      {
        entityType: "article",
        entityId: created.id as string,
        versionId: "stale_ver",
      },
      {
        entityType: "article",
        entityId: "missing",
        versionId: "x",
      },
    ]);
    expect(results.map((r) => r.visible)).toEqual([true, false, false]);
  });

  it("index failure does not throw from indexing service", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "fail-record",
      title: "Fail Record",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "x")],
    });
    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );

    const index = getMemorySearchIndexForTests();
    index.applyMutation = async () => {
      throw new Error("forced");
    };

    await expect(
      indexAfterArticlePublish({
        ports,
        articleId: created.id as string,
        versionId: published.versionId,
      }),
    ).resolves.toBeUndefined();
  });

  it("empty query returns empty set without catalog dump", async () => {
    const result = await executePublicSearch({ q: "" });
    expect(result.emptyQuery).toBe(true);
    expect(result.items).toEqual([]);
  });

  it("builds prompt SearchDocument with prompt fields", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "prompt-search",
      title: "Prompt Title",
      promptText: "Do the thing carefully",
      ownerId: "user_1",
    });
    const published = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    const version = await ports.versions.getById(published.versionId);
    const live = await ports.prompts.getById(created.id as string);
    const doc = buildPromptSearchDocument({
      live: live!,
      snapshot: version!.snapshot as ReturnType<typeof toPromptSnapshot>,
      versionId: published.versionId,
      versionNumber: 1,
    });
    expect(doc.entityType).toBe("prompt");
    expect(doc.promptText).toMatch(/Do the thing/);
    expect(doc.title).toBe("Prompt Title");
    expect(doc.href).toBe(`/prompts/${live!.slug}`);
  });
});
