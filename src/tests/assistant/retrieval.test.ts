import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchBackedAssistantRetrieval } from "@/server/assistant/search-backed-retrieval";
import { ContentPortsAssistantContentAdapter } from "@/server/assistant/content-ports-assistant-content";
import { ContentPortsSearchVisibility } from "@/server/search/public-search-visibility";
import { MemorySearchIndexAdapter } from "@/server/repositories/memory/memory-search-index";
import {
  createArticleUseCase,
  hideArticle,
  archiveArticle,
  publishArticle,
  replaceArticleBlocks,
} from "@/features/content/application/article-use-cases";
import {
  createPromptUseCase,
  publishPrompt,
} from "@/features/content/application/prompt-use-cases";
import {
  createTestPorts,
  paragraphBlock,
  testCtx,
} from "@/tests/builders/content";
import { RepositoryError } from "@/domain/shared/errors";
import { resetAssistantTestEnv } from "./helpers";

describe("assistant retrieval", () => {
  beforeEach(() => {
    resetAssistantTestEnv("fake");
  });

  async function setup() {
    const ports = createTestPorts();
    const index = new MemorySearchIndexAdapter();
    const visibility = new ContentPortsSearchVisibility(ports);
    const content = new ContentPortsAssistantContentAdapter(ports);
    const retrieval = new SearchBackedAssistantRetrieval(
      index,
      visibility,
      content,
    );
    return { ports, index, visibility, content, retrieval };
  }

  it("retrieves published article and excludes draft hidden archived prompts by default", async () => {
    const { ports, index, retrieval } = await setup();
    const ctx = testCtx();

    const article = await createArticleUseCase(ports, ctx, {
      slug: "policy-a",
      title: "Policy Vacation",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "Отпуск оформляется заранее")],
    });
    const pub = await publishArticle(ports, ctx, article.id, article.revision);
    const { buildArticleSearchDocument } = await import(
      "@/features/search/application/build-search-document"
    );
    const version = await ports.versions.getById(pub.versionId);
    const doc = buildArticleSearchDocument({
      live: pub.article,
      snapshot: version!.snapshot as never,
      versionId: pub.versionId,
      versionNumber: 1,
    });
    await index.applyMutation({ type: "upsert", document: doc });

    const draft = await createArticleUseCase(ports, ctx, {
      slug: "draft-only",
      title: "Policy Draft Secret",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "секретный черновик")],
    });
    // Force-index draft-like doc should still fail visibility
    await index.applyMutation({
      type: "upsert",
      document: {
        ...doc,
        id: `article:${draft.id}`,
        entityId: draft.id as string,
        title: "Policy Draft Secret",
        slug: "draft-only",
        href: "/articles/draft-only",
        versionId: "ver_fake_draft",
        searchableText: "Policy Draft Secret секретный черновик",
        bodyText: "секретный черновик",
      },
    });

    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "prompt-a",
      title: "Policy Prompt Helper",
      ownerId: "user_1",
      promptText: "Напиши письмо об отпуске",
    });
    const promptPub = await publishPrompt(
      ports,
      ctx,
      prompt.id,
      prompt.revision,
    );
    const { buildPromptSearchDocument } = await import(
      "@/features/search/application/build-search-document"
    );
    const promptVersion = await ports.versions.getById(promptPub.versionId);
    await index.applyMutation({
      type: "upsert",
      document: buildPromptSearchDocument({
        live: promptPub.prompt,
        snapshot: promptVersion!.snapshot as never,
        versionId: promptPub.versionId,
        versionNumber: 1,
      }),
    });

    const defaultResult = await retrieval.retrieve({
      question: "Policy Vacation отпуск",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(defaultResult.status).toBe("ok");
    expect(defaultResult.sources.every((s) => s.entityType === "article")).toBe(
      true,
    );
    expect(defaultResult.sources.some((s) => s.entityId === draft.id)).toBe(
      false,
    );
    expect(defaultResult.chunks.length).toBeGreaterThan(0);

    const withPrompt = await retrieval.retrieve({
      question: "Policy Prompt Helper",
      filters: {
        type: "prompt",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(withPrompt.status).toBe("ok");
    expect(withPrompt.sources[0]?.entityType).toBe("prompt");

    const all = await retrieval.retrieve({
      question: "Policy",
      filters: {
        type: "all",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(all.status).toBe("ok");
    expect(all.sources.some((s) => s.entityType === "article")).toBe(true);
    expect(all.sources.some((s) => s.entityType === "prompt")).toBe(true);

    // hide article
    const live = await ports.articles.getById(article.id);
    await hideArticle(ports, ctx, article.id, live!.revision);
    const afterHide = await retrieval.retrieve({
      question: "Policy Vacation отпуск",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(afterHide.status).toBe("empty");
  });

  it("excludes version mismatch and archived", async () => {
    const { ports, index, retrieval } = await setup();
    const ctx = testCtx();
    const article = await createArticleUseCase(ports, ctx, {
      slug: "versioned",
      title: "Versioned Policy",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "версия один")],
    });
    const pub1 = await publishArticle(ports, ctx, article.id, article.revision);
    const { buildArticleSearchDocument } = await import(
      "@/features/search/application/build-search-document"
    );
    const v1 = await ports.versions.getById(pub1.versionId);
    await index.applyMutation({
      type: "upsert",
      document: buildArticleSearchDocument({
        live: pub1.article,
        snapshot: v1!.snapshot as never,
        versionId: pub1.versionId,
        versionNumber: 1,
      }),
    });

    const live = await ports.articles.getById(article.id);
    const updated = await replaceArticleBlocks(
      ports,
      ctx,
      article.id,
      live!.revision,
      [paragraphBlock("p1", "версия два")],
    );
    const pub2 = await publishArticle(
      ports,
      ctx,
      article.id,
      updated.revision,
    );
    // Index still has v1 while live is v2 → stale excluded
    const stale = await retrieval.retrieve({
      question: "Versioned Policy",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(stale.status).toBe("empty");

    await index.applyMutation({
      type: "upsert",
      document: buildArticleSearchDocument({
        live: pub2.article,
        snapshot: (await ports.versions.getById(pub2.versionId))!
          .snapshot as never,
        versionId: pub2.versionId,
        versionNumber: 2,
      }),
    });
    const ok = await retrieval.retrieve({
      question: "Versioned Policy",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(ok.status).toBe("ok");

    const current = await ports.articles.getById(article.id);
    await archiveArticle(ports, ctx, article.id, current!.revision);
    const archived = await retrieval.retrieve({
      question: "Versioned Policy",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(archived.status).toBe("empty");
  });

  it("maps unavailable index and visibility failures", async () => {
    const ports = createTestPorts();
    const content = new ContentPortsAssistantContentAdapter(ports);
    const failingIndex = {
      search: vi.fn(async () => {
        throw new RepositoryError("down", {
          adminCode: "SEARCH_INDEX_UNAVAILABLE",
        });
      }),
    };
    const retrieval = new SearchBackedAssistantRetrieval(
      failingIndex as never,
      new ContentPortsSearchVisibility(ports),
      content,
    );
    const result = await retrieval.retrieve({
      question: "anything here",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(result.status).toBe("unavailable");

    const index = new MemorySearchIndexAdapter();
    const { buildArticleSearchDocument } = await import(
      "@/features/search/application/build-search-document"
    );
    const ctx = testCtx();
    const article = await createArticleUseCase(ports, ctx, {
      slug: "vis-fail",
      title: "Visibility Fail Doc",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "текст")],
    });
    const pub = await publishArticle(ports, ctx, article.id, article.revision);
    const version = await ports.versions.getById(pub.versionId);
    await index.applyMutation({
      type: "upsert",
      document: buildArticleSearchDocument({
        live: pub.article,
        snapshot: version!.snapshot as never,
        versionId: pub.versionId,
        versionNumber: 1,
      }),
    });
    const failingVisibility = {
      filterVisible: vi.fn(async () => {
        throw new RepositoryError("vis", {
          adminCode: "SEARCH_INDEX_UNAVAILABLE",
        });
      }),
    };
    const retrieval2 = new SearchBackedAssistantRetrieval(
      index,
      failingVisibility as never,
      content,
    );
    const unavailable = await retrieval2.retrieve({
      question: "Visibility Fail",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(unavailable.status).toBe("unavailable");
  });

  it("batch hydrates without unbounded N+1 pattern and deduplicates", async () => {
    const { ports, index, retrieval, content } = await setup();
    const ctx = testCtx();
    const spy = vi.spyOn(ports.articles, "getById");
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      const article = await createArticleUseCase(ports, ctx, {
        slug: `batch-${i}`,
        title: `Batch Policy ${i}`,
        ownerId: "user_1",
        blocks: [paragraphBlock("p1", `batch body ${i}`)],
      });
      const pub = await publishArticle(
        ports,
        ctx,
        article.id,
        article.revision,
      );
      created.push(pub);
      const { buildArticleSearchDocument } = await import(
        "@/features/search/application/build-search-document"
      );
      const version = await ports.versions.getById(pub.versionId);
      await index.applyMutation({
        type: "upsert",
        document: buildArticleSearchDocument({
          live: pub.article,
          snapshot: version!.snapshot as never,
          versionId: pub.versionId,
          versionNumber: 1,
        }),
      });
    }
    // Duplicate candidate via second upsert same entity is fine; search returns unique docs
    const result = await retrieval.retrieve({
      question: "Batch Policy",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(result.status).toBe("ok");
    const ids = result.sources.map((s) => s.entityId);
    expect(new Set(ids).size).toBe(ids.length);
    // Visibility + hydration each call getById; bounded by candidate count * small constant
    expect(spy.mock.calls.length).toBeLessThanOrEqual(20);
    void content;
  });
});
