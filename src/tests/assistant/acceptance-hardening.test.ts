import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  buildProviderEvidence,
  parseProviderResult,
  toPublicAnsweredDto,
  validateAndBuildCitations,
} from "@/domain/assistant/citations";
import { assertSafeAssistantPlainText } from "@/domain/assistant/output-safety";
import { assertSafeAssistantSearchHref } from "@/domain/assistant/search-fallback";
import { normalizeAssistantQuestion } from "@/domain/assistant/text";
import { askAssistant } from "@/features/assistant/application/ask-assistant";
import { ContentPortsAssistantContentAdapter } from "@/server/assistant/content-ports-assistant-content";
import { FakeAssistantProviderAdapter } from "@/server/assistant/providers/fake-provider";
import { InProcessAssistantRateLimitAdapter } from "@/server/assistant/rate-limit";
import { SearchBackedAssistantRetrieval } from "@/server/assistant/search-backed-retrieval";
import { ContentPortsSearchVisibility } from "@/server/search/public-search-visibility";
import { MemorySearchIndexAdapter } from "@/server/repositories/memory/memory-search-index";
import { buildArticleSearchDocument } from "@/features/search/application/build-search-document";
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
  paragraphBlock,
  testCtx,
} from "@/tests/builders/content";
import { readBoundedJsonBody } from "@/server/http/read-bounded-json-body";
import { POST, OPTIONS } from "@/app/api/assistant/ask/route";
import { logger } from "@/lib/logger";
import { RepositoryError } from "@/domain/shared/errors";
import { assistantAskHeaders, resetAssistantTestEnv } from "./helpers";
import type { AssistantProviderPort } from "@/server/repositories/interfaces/assistant-provider-port";
import type { AssistantRetrievalPort } from "@/server/repositories/interfaces/assistant-retrieval-port";

describe("8C.1 acceptance: authoritative binding", () => {
  beforeEach(() => resetAssistantTestEnv("fake"));

  it("rejects cross-entity and cross-type versionIds fail-closed", async () => {
    const ports = createTestPorts();
    const content = new ContentPortsAssistantContentAdapter(ports);
    const ctx = testCtx();

    const a = await createArticleUseCase(ports, ctx, {
      slug: "article-a",
      title: "Article A",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "body A")],
    });
    const pubA = await publishArticle(ports, ctx, a.id, a.revision);

    const b = await createArticleUseCase(ports, ctx, {
      slug: "article-b",
      title: "Article B Poison",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "body B")],
    });
    const pubB = await publishArticle(ports, ctx, b.id, b.revision);

    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "prompt-x",
      title: "Prompt X",
      ownerId: "user_1",
      promptText: "prompt body",
    });
    const pubP = await publishPrompt(ports, ctx, prompt.id, prompt.revision);

    // Article A candidate pointing at B's version
    const crossArticle = await content.loadPublishedSnapshots([
      {
        entityType: "article",
        entityId: a.id as string,
        versionId: pubB.versionId,
      },
    ]);
    expect(crossArticle[0]?.status).not.toBe("ok");

    // Article pointing at Prompt version
    const articlePromptVersion = await content.loadPublishedSnapshots([
      {
        entityType: "article",
        entityId: a.id as string,
        versionId: pubP.versionId,
      },
    ]);
    expect(articlePromptVersion[0]?.status).not.toBe("ok");

    // Prompt pointing at Article version
    const promptArticleVersion = await content.loadPublishedSnapshots([
      {
        entityType: "prompt",
        entityId: prompt.id as string,
        versionId: pubA.versionId,
      },
    ]);
    expect(promptArticleVersion[0]?.status).not.toBe("ok");

    // Missing version
    const missing = await content.loadPublishedSnapshots([
      {
        entityType: "article",
        entityId: a.id as string,
        versionId: "ver_does_not_exist",
      },
    ]);
    expect(missing[0]?.status).not.toBe("ok");

    // Valid binding still works
    const ok = await content.loadPublishedSnapshots([
      {
        entityType: "article",
        entityId: a.id as string,
        versionId: pubA.versionId,
      },
    ]);
    expect(ok[0]?.status).toBe("ok");
    if (ok[0]?.status === "ok") {
      expect(ok[0].title).toBe("Article A");
      expect(ok[0].href).toBe("/articles/article-a");
    }
  });

  it("uses authoritative title/href not poisoned SearchDocument fields", async () => {
    const ports = createTestPorts();
    const index = new MemorySearchIndexAdapter();
    const retrieval = new SearchBackedAssistantRetrieval(
      index,
      new ContentPortsSearchVisibility(ports),
      new ContentPortsAssistantContentAdapter(ports),
    );
    const ctx = testCtx();
    const article = await createArticleUseCase(ports, ctx, {
      slug: "real-slug",
      title: "Real Title",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "authoritative body")],
    });
    const pub = await publishArticle(ports, ctx, article.id, article.revision);
    const version = await ports.versions.getById(pub.versionId);
    const doc = buildArticleSearchDocument({
      live: pub.article,
      snapshot: version!.snapshot as never,
      versionId: pub.versionId,
      versionNumber: 1,
    });
    await index.applyMutation({
      type: "upsert",
      document: {
        ...doc,
        title: "POISONED TITLE",
        href: "https://evil.example/phish",
        slug: "stale-slug",
      },
    });

    const result = await retrieval.retrieve({
      question: "Real Title authoritative",
      filters: {
        type: "article",
        categoryId: null,
        tagId: null,
        audienceId: null,
      },
    });
    expect(result.status).toBe("ok");
    expect(result.sources[0]?.title).toBe("Real Title");
    expect(result.sources[0]?.href).toBe("/articles/real-slug");
    expect(result.sources[0]?.href).not.toMatch(/evil|stale-slug|POISONED/);
  });
});

describe("8C.1 acceptance: evidence isolation and citations", () => {
  it("keeps request-local evidence keys under parallel calls", async () => {
    const sourcesA = [
      {
        sourceId: "sa",
        entityType: "article" as const,
        entityId: "a",
        versionId: "va",
        title: "A",
        href: "/articles/a",
        publishedAt: null,
        order: 0,
      },
    ];
    const sourcesB = [
      {
        sourceId: "sb",
        entityType: "article" as const,
        entityId: "b",
        versionId: "vb",
        title: "B",
        href: "/articles/b",
        publishedAt: null,
        order: 0,
      },
    ];
    const chunksA = [
      {
        chunkId: "ca",
        sourceId: "sa",
        versionId: "va",
        headingPath: "t",
        text: "text A",
        ordinal: 0,
        characterCount: 6,
        trustBoundary: "published_content" as const,
      },
    ];
    const chunksB = [
      {
        chunkId: "cb",
        sourceId: "sb",
        versionId: "vb",
        headingPath: "t",
        text: "text B",
        ordinal: 0,
        characterCount: 6,
        trustBoundary: "published_content" as const,
      },
    ];

    const builtA = buildProviderEvidence(sourcesA, chunksA);
    const builtB = buildProviderEvidence(sourcesB, chunksB);
    expect(builtA.keyToSourceId.get("E1")).toBe("sa");
    expect(builtB.keyToSourceId.get("E1")).toBe("sb");

    const delayedA = validateAndBuildCitations({
      providerResult: {
        kind: "answered",
        blocks: [{ text: "Ответ А", evidenceKeys: ["E1"] }],
        usage: {
          inputCharacters: 1,
          outputCharacters: 1,
          evidenceSourceCount: 1,
          evidenceChunkCount: 1,
        },
        finishReason: "completed",
        providerStatus: "ok",
      },
      sources: sourcesA,
      chunks: chunksA,
      keyToSourceId: builtA.keyToSourceId,
    });
    const cross = validateAndBuildCitations({
      providerResult: {
        kind: "answered",
        blocks: [{ text: "Ответ", evidenceKeys: ["E1"] }],
        usage: {
          inputCharacters: 1,
          outputCharacters: 1,
          evidenceSourceCount: 1,
          evidenceChunkCount: 1,
        },
        finishReason: "completed",
        providerStatus: "ok",
      },
      sources: sourcesA,
      chunks: chunksA,
      keyToSourceId: builtB.keyToSourceId,
    });
    expect(delayedA.ok).toBe(true);
    expect(cross.ok).toBe(false);
  });

  it("numbers citations by first use and omits unused sources", () => {
    const sources = [
      {
        sourceId: "s1",
        entityType: "article" as const,
        entityId: "a1",
        versionId: "v1",
        title: "One",
        href: "/articles/one",
        publishedAt: null,
        order: 0,
      },
      {
        sourceId: "s2",
        entityType: "article" as const,
        entityId: "a2",
        versionId: "v2",
        title: "Two",
        href: "/articles/two",
        publishedAt: null,
        order: 1,
      },
    ];
    const chunks = [
      {
        chunkId: "c1",
        sourceId: "s1",
        versionId: "v1",
        headingPath: "t",
        text: "chunk1",
        ordinal: 0,
        characterCount: 6,
        trustBoundary: "published_content" as const,
      },
      {
        chunkId: "c1b",
        sourceId: "s1",
        versionId: "v1",
        headingPath: "t2",
        text: "chunk1b",
        ordinal: 1,
        characterCount: 7,
        trustBoundary: "published_content" as const,
      },
      {
        chunkId: "c2",
        sourceId: "s2",
        versionId: "v2",
        headingPath: "t",
        text: "chunk2",
        ordinal: 0,
        characterCount: 6,
        trustBoundary: "published_content" as const,
      },
    ];
    const { keyToSourceId } = buildProviderEvidence(sources, chunks);
    const result = validateAndBuildCitations({
      providerResult: {
        kind: "answered",
        blocks: [
          { text: "Блок два", evidenceKeys: ["E3", "E3"] },
          { text: "Блок один", evidenceKeys: ["E1", "E2"] },
        ],
        usage: {
          inputCharacters: 1,
          outputCharacters: 1,
          evidenceSourceCount: 2,
          evidenceChunkCount: 3,
        },
        finishReason: "completed",
        providerStatus: "ok",
      },
      sources,
      chunks,
      keyToSourceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]?.href).toBe("/articles/two");
    expect(result.citations[0]?.number).toBe(1);
    expect(result.citations[1]?.number).toBe(2);
    expect(result.blocks[0]?.citationNumbers).toEqual([1]);
    // E1 and E2 are two chunks of the same source → one citation number
    expect(result.blocks[1]?.citationNumbers).toEqual([2]);
    const dto = toPublicAnsweredDto(result);
    expect(JSON.stringify(dto)).not.toMatch(/evidenceKey|chunkId|versionId|E1/);
  });
});

describe("8C.1 acceptance: output safety", () => {
  it.each([
    ["<script>alert(1)</script>", false],
    ["<b>x</b>", false],
    ["[text](https://evil.example)", false],
    ["![img](https://x)", false],
    ["see https://example.com", false],
    ["go //example.com now", false],
    ["javascript:alert(1)", false],
    ["data:text/html,hi", false],
    ["См. источник [1] здесь", false],
    ["Обычный русский текст", true],
    ["1. Первый шаг; 2. Второй", true],
    ["Значение [важно] для работы", true],
  ])("%s → ok=%s", (text, ok) => {
    expect(assertSafeAssistantPlainText(text).ok).toBe(ok);
  });

  it("rejects unsafe provider blocks", () => {
    const sources = [
      {
        sourceId: "s1",
        entityType: "article" as const,
        entityId: "a1",
        versionId: "v1",
        title: "T",
        href: "/articles/t",
        publishedAt: null,
        order: 0,
      },
    ];
    const chunks = [
      {
        chunkId: "c1",
        sourceId: "s1",
        versionId: "v1",
        headingPath: "t",
        text: "e",
        ordinal: 0,
        characterCount: 1,
        trustBoundary: "published_content" as const,
      },
    ];
    const { keyToSourceId } = buildProviderEvidence(sources, chunks);
    const bad = validateAndBuildCitations({
      providerResult: {
        kind: "answered",
        blocks: [{ text: "см. [1]", evidenceKeys: ["E1"] }],
        usage: {
          inputCharacters: 1,
          outputCharacters: 1,
          evidenceSourceCount: 1,
          evidenceChunkCount: 1,
        },
        finishReason: "completed",
        providerStatus: "ok",
      },
      sources,
      chunks,
      keyToSourceId,
    });
    expect(bad.ok).toBe(false);
  });

  it("rejects invalid provider schema shapes", () => {
    expect(parseProviderResult(null)).toBeNull();
    expect(parseProviderResult({ kind: "answered" })).toBeNull();
    expect(
      parseProviderResult({
        kind: "answered",
        blocks: [],
        usage: {
          inputCharacters: 1,
          outputCharacters: 1,
          evidenceSourceCount: 1,
          evidenceChunkCount: 1,
        },
        finishReason: "completed",
        providerStatus: "ok",
      }),
    ).toBeNull();
    expect(
      parseProviderResult({
        kind: "answered",
        blocks: [{ text: "x", evidenceKeys: ["E1"] }],
        usage: {
          inputCharacters: Number.NaN,
          outputCharacters: 1,
          evidenceSourceCount: 1,
          evidenceChunkCount: 1,
        },
        finishReason: "completed",
        providerStatus: "ok",
        extra: true,
      }),
    ).toBeNull();
    expect(
      parseProviderResult({
        kind: "refused",
        refusalCategory: "no_evidence",
        blocks: [{ text: "x", evidenceKeys: ["E1"] }],
        usage: {
          inputCharacters: 0,
          outputCharacters: 0,
          evidenceSourceCount: 0,
          evidenceChunkCount: 0,
        },
        finishReason: "refused",
        providerStatus: "ok",
      }),
    ).toBeNull();
  });
});

describe("8C.1 acceptance: timeouts concurrency body origin", () => {
  beforeEach(() => {
    resetAssistantTestEnv("fake");
  });

  afterEach(() => {
    resetAssistantTestEnv("fake");
  });

  it("releases concurrency after timeout and ignores late provider", async () => {
    vi.stubEnv("ASSISTANT_PROVIDER_TIMEOUT_MS", "50");
    vi.stubEnv("ASSISTANT_APPLICATION_TIMEOUT_MS", "200");
    const { resetAssistantEnvCacheForTests } = await import(
      "@/config/assistant-env"
    );
    resetAssistantEnvCacheForTests();

    const rateLimit = new InProcessAssistantRateLimitAdapter({
      limit: 50,
      maxConcurrent: 1,
    });
    let resolveProvider!: (v: unknown) => void;
    const hanging: AssistantProviderPort = {
      generateGroundedAnswer: () =>
        new Promise((resolve) => {
          resolveProvider = resolve as (v: unknown) => void;
        }),
    };
    const retrieval: AssistantRetrievalPort = {
      retrieve: async () => ({
        status: "ok",
        sources: [
          {
            sourceId: "s1",
            entityType: "article",
            entityId: "a1",
            versionId: "v1",
            title: "T",
            href: "/articles/t",
            publishedAt: null,
            order: 0,
          },
        ],
        chunks: [
          {
            chunkId: "c1",
            sourceId: "s1",
            versionId: "v1",
            headingPath: "t",
            text: "evidence",
            ordinal: 0,
            characterCount: 8,
            trustBoundary: "published_content",
          },
        ],
        meta: {
          candidateCount: 1,
          scannedCount: 1,
          generationId: "g1",
        },
      }),
      revalidate: async () => ({ valid: true, invalidReferences: [] }),
    };

    const firstResult = await askAssistant(
      {
        question: "Timeout Policy Guide",
        requestId: "req_to",
        rateLimitKey: "assistant:to",
      },
      { retrieval, provider: hanging, rateLimit },
    );
    expect(firstResult.body.status).toBe("temporarily_unavailable");

    resolveProvider!({
      kind: "answered",
      blocks: [{ text: "late", evidenceKeys: ["E1"] }],
      usage: {
        inputCharacters: 1,
        outputCharacters: 1,
        evidenceSourceCount: 1,
        evidenceChunkCount: 1,
      },
      finishReason: "completed",
      providerStatus: "ok",
    });

    resetAssistantTestEnv("fake");
    const second = await askAssistant(
      {
        question: "Timeout Policy Guide",
        requestId: "req_to2",
        rateLimitKey: "assistant:to",
      },
      {
        retrieval,
        provider: new FakeAssistantProviderAdapter(),
        rateLimit,
      },
    );
    expect(second.body.status).toBe("answered");
  });

  it("disabled mode does not call retrieval or provider", async () => {
    resetAssistantTestEnv("disabled");
    const retrieve = vi.fn();
    const generate = vi.fn();
    const result = await askAssistant(
      {
        question: "Should not retrieve this question text",
        requestId: "req_dis2",
        rateLimitKey: "assistant:dis",
      },
      {
        retrieval: { retrieve, revalidate: vi.fn() },
        provider: { generateGroundedAnswer: generate },
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 10 }),
      },
    );
    expect(result.body.status).toBe("temporarily_unavailable");
    expect(retrieve).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("bounded body reader enforces bytes and cancels", async () => {
    const oversized = await readBoundedJsonBody(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "99999" },
        body: "{}",
      }),
      100,
    );
    expect(oversized).toEqual({ ok: false, reason: "too_large" });

    const malformedCl = await readBoundedJsonBody(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "abc" },
        body: "{}",
      }),
      1000,
    );
    expect(malformedCl).toEqual({
      ok: false,
      reason: "invalid_content_length",
    });

    const multibyte = "я".repeat(100);
    const bytes = new TextEncoder().encode(
      JSON.stringify({ question: multibyte }),
    );
    const overMulti = await readBoundedJsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: bytes,
      }),
      bytes.byteLength - 1,
    );
    expect(overMulti.ok).toBe(false);

    const exact = await readBoundedJsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: bytes,
      }),
      bytes.byteLength,
    );
    expect(exact.ok).toBe(true);
  });

  it("route rejects cross-origin null origin options and provider field", async () => {
    resetAssistantTestEnv("fake");
    const cross = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders({ origin: "https://evil.example" }),
        body: JSON.stringify({ question: "API Policy Document" }),
      }),
    );
    expect(cross.status).toBe(403);
    expect(cross.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const nullOrigin = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders({ origin: "null" }),
        body: JSON.stringify({ question: "API Policy Document" }),
      }),
    );
    expect(nullOrigin.status).toBe(403);

    const missingOrigin = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "1.2.3.4",
          "x-forwarded-host": "localhost:3000",
        },
        body: JSON.stringify({ question: "API Policy Document" }),
      }),
    );
    expect(missingOrigin.status).toBe(403);

    const preflight = await OPTIONS();
    expect(preflight.status).toBe(405);

    const providerField = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: JSON.stringify({
          question: "API Policy Document",
          provider: "fake",
        }),
      }),
    );
    expect(providerField.status).toBe(400);
  });

  it("normalizes question before min-length check without logging it", async () => {
    const logSpy = vi.spyOn(logger, "info");
    const rateLimit = new InProcessAssistantRateLimitAdapter({ limit: 10 });
    const retrieval = {
      retrieve: vi.fn(),
      revalidate: vi.fn(),
    };
    const result = await askAssistant(
      {
        question: "  \u0000\u0001  ",
        requestId: "req_ws",
        rateLimitKey: "assistant:ws",
      },
      {
        retrieval,
        provider: new FakeAssistantProviderAdapter(),
        rateLimit,
      },
    );
    expect(result.body.status).toBe("validation_error");
    expect(retrieval.retrieve).not.toHaveBeenCalled();
    expect(normalizeAssistantQuestion("  \u0000\u0001  ")).toBe("");
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/\u0000|question/);
    }
    logSpy.mockRestore();
  });

  it("search fallback href stays internal", () => {
    expect(assertSafeAssistantSearchHref("/search?q=x")).toBe("/search?q=x");
    expect(assertSafeAssistantSearchHref("//evil")).toBeNull();
    expect(assertSafeAssistantSearchHref("https://x")).toBeNull();
    expect(assertSafeAssistantSearchHref("/articles/x")).toBeNull();
  });
});

describe("8C.1 acceptance: final visibility cited-only", () => {
  beforeEach(() => resetAssistantTestEnv("fake"));

  it("unused stale source does not block; cited stale does", async () => {
    const ports = createTestPorts();
    const index = new MemorySearchIndexAdapter();
    const retrieval = new SearchBackedAssistantRetrieval(
      index,
      new ContentPortsSearchVisibility(ports),
      new ContentPortsAssistantContentAdapter(ports),
    );
    const ctx = testCtx();
    const a1 = await createArticleUseCase(ports, ctx, {
      slug: "cite-keep",
      title: "Cite Keep Guide",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "keep body")],
    });
    const pub1 = await publishArticle(ports, ctx, a1.id, a1.revision);
    const a2 = await createArticleUseCase(ports, ctx, {
      slug: "cite-drop",
      title: "Cite Drop Guide",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "drop body")],
    });
    const pub2 = await publishArticle(ports, ctx, a2.id, a2.revision);
    for (const pub of [pub1, pub2]) {
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

    const provider: AssistantProviderPort = {
      async generateGroundedAnswer(req) {
        const key = req.evidence[0]!.evidenceKey;
        return {
          kind: "answered",
          blocks: [{ text: "Только первый источник", evidenceKeys: [key] }],
          usage: {
            inputCharacters: 1,
            outputCharacters: 1,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        };
      },
    };

    // Hide unused second after retrieval is prepared via custom revalidate wrapper
    const base = retrieval;
    const wrapped: AssistantRetrievalPort = {
      retrieve: (r) => base.retrieve(r),
      revalidate: async (refs) => {
        // Hide drop article before revalidation of cited-only refs
        const live = await ports.articles.getById(a2.id);
        if (live && live.status === "published") {
          await hideArticle(ports, ctx, a2.id, live.revision);
        }
        return base.revalidate(refs);
      },
    };

    const ok = await askAssistant(
      {
        question: "Cite Keep Guide",
        requestId: "req_cite",
        rateLimitKey: "assistant:cite",
      },
      {
        retrieval: wrapped,
        provider,
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 20 }),
      },
    );
    expect(ok.body.status).toBe("answered");

    const staleCited: AssistantRetrievalPort = {
      retrieve: (r) => base.retrieve(r),
      revalidate: async () => ({
        valid: false,
        invalidReferences: [
          {
            entityType: "article",
            entityId: a1.id as string,
            versionId: pub1.versionId,
          },
        ],
      }),
    };
    const blocked = await askAssistant(
      {
        question: "Cite Keep Guide",
        requestId: "req_cite2",
        rateLimitKey: "assistant:cite2",
      },
      {
        retrieval: staleCited,
        provider,
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 20 }),
      },
    );
    expect(blocked.body.status).toBe("insufficient_evidence");
  });

  it("provider unavailable maps to 503 without internals", async () => {
    const retrieval: AssistantRetrievalPort = {
      retrieve: async () => ({
        status: "unavailable",
        sources: [],
        chunks: [],
        meta: {
          candidateCount: 0,
          scannedCount: 0,
          generationId: null,
          incompleteReason: "index_unavailable",
        },
      }),
      revalidate: async () => ({ valid: true, invalidReferences: [] }),
    };
    const result = await askAssistant(
      {
        question: "Anything available now",
        requestId: "req_unavail",
        rateLimitKey: "assistant:unavail",
      },
      {
        retrieval,
        provider: new FakeAssistantProviderAdapter(),
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 10 }),
      },
    );
    expect(result.httpStatus).toBe(503);
    expect(JSON.stringify(result.body)).not.toMatch(
      /generationId|index_unavailable|versionId|stack/i,
    );
    void RepositoryError;
  });
});

describe("8C.1 acceptance: generation incomplete abort privacy", () => {
  beforeEach(() => resetAssistantTestEnv("fake"));
  afterEach(() => resetAssistantTestEnv("fake"));

  it("does not call provider on incomplete or unavailable retrieval", async () => {
    const generate = vi.fn();
    for (const status of ["incomplete", "unavailable"] as const) {
      generate.mockClear();
      const result = await askAssistant(
        {
          question: "Incomplete Retrieval Case",
          requestId: `req_${status}`,
          rateLimitKey: `assistant:${status}`,
        },
        {
          retrieval: {
            retrieve: async () => ({
              status,
              sources: [],
              chunks: [],
              meta: {
                candidateCount: 40,
                scannedCount: 20,
                generationId: status === "unavailable" ? null : "g-old",
                incompleteReason:
                  status === "unavailable"
                    ? "index_unavailable"
                    : "scan_exhaustion",
              },
            }),
            revalidate: vi.fn(),
          },
          provider: { generateGroundedAnswer: generate },
          rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 20 }),
        },
      );
      expect(generate).not.toHaveBeenCalled();
      expect(result.body.status).toBe(
        status === "unavailable"
          ? "temporarily_unavailable"
          : "insufficient_evidence",
      );
    }
  });

  it("index generation errors map to unavailable without provider call", async () => {
    const generate = vi.fn();
    const index = {
      search: async () => {
        throw new RepositoryError("SEARCH_GENERATION_CORRUPT", {
          adminCode: "SEARCH_GENERATION_CORRUPT",
        });
      },
      getActiveGeneration: async () => null,
      replaceActiveGeneration: async () => {},
      deleteGeneration: async () => {},
    };
    const ports = createTestPorts();
    const retrieval = new SearchBackedAssistantRetrieval(
      index as never,
      new ContentPortsSearchVisibility(ports),
      new ContentPortsAssistantContentAdapter(ports),
    );
    const result = await askAssistant(
      {
        question: "Corrupt Generation Case",
        requestId: "req_corrupt",
        rateLimitKey: "assistant:corrupt",
      },
      {
        retrieval,
        provider: { generateGroundedAnswer: generate },
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 10 }),
      },
    );
    expect(result.body.status).toBe("temporarily_unavailable");
    expect(generate).not.toHaveBeenCalled();
  });

  it("aborts before retrieval skip provider and release concurrency", async () => {
    const retrieve = vi.fn(async () => {
      await new Promise(() => {
        /* never resolves */
      });
      return {
        status: "empty" as const,
        sources: [],
        chunks: [],
        meta: { candidateCount: 0, scannedCount: 0, generationId: null },
      };
    });
    const generate = vi.fn();
    const rateLimit = new InProcessAssistantRateLimitAdapter({
      limit: 20,
      maxConcurrent: 1,
    });
    const ac = new AbortController();
    ac.abort();
    const aborted = await askAssistant(
      {
        question: "Aborted Before Retrieval",
        requestId: "req_ab1",
        rateLimitKey: "assistant:ab",
        signal: ac.signal,
      },
      {
        retrieval: { retrieve, revalidate: vi.fn() },
        provider: { generateGroundedAnswer: generate },
        rateLimit,
      },
    );
    expect(aborted.body.status).toBe("temporarily_unavailable");
    expect(generate).not.toHaveBeenCalled();

    const next = await askAssistant(
      {
        question: "After Abort Slot Free",
        requestId: "req_ab2",
        rateLimitKey: "assistant:ab",
      },
      {
        retrieval: {
          retrieve: async () => ({
            status: "empty",
            sources: [],
            chunks: [],
            meta: { candidateCount: 0, scannedCount: 0, generationId: "g1" },
          }),
          revalidate: vi.fn(),
        },
        provider: { generateGroundedAnswer: generate },
        rateLimit,
      },
    );
    expect(next.body.status).toBe("insufficient_evidence");
  });

  it("provider request omits href entityId versionId chunkId headers", async () => {
    let captured: unknown;
    const provider: AssistantProviderPort = {
      generateGroundedAnswer: async (req) => {
        captured = req;
        return {
          kind: "answered",
          blocks: [
            { text: "Ответ по материалу без ссылок.", evidenceKeys: ["E1"] },
          ],
          usage: {
            inputCharacters: 10,
            outputCharacters: 20,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        };
      },
    };
    const result = await askAssistant(
      {
        question: "Provider Request Shape Check",
        requestId: "req_shape",
        rateLimitKey: "assistant:shape",
      },
      {
        retrieval: {
          retrieve: async () => ({
            status: "ok",
            sources: [
              {
                sourceId: "s1",
                entityType: "article",
                entityId: "secret-entity",
                versionId: "secret-version",
                title: "Safe Label",
                href: "/articles/safe-label",
                publishedAt: null,
                order: 0,
              },
            ],
            chunks: [
              {
                chunkId: "secret-chunk",
                sourceId: "s1",
                versionId: "secret-version",
                headingPath: "h",
                text: "bounded evidence text",
                ordinal: 0,
                characterCount: 21,
                trustBoundary: "published_content",
              },
            ],
            meta: {
              candidateCount: 1,
              scannedCount: 1,
              generationId: "g1",
            },
          }),
          revalidate: async () => ({ valid: true, invalidReferences: [] }),
        },
        provider,
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 10 }),
      },
    );
    expect(result.body.status).toBe("answered");
    const json = JSON.stringify(captured);
    expect(json).not.toMatch(/secret-entity|secret-version|secret-chunk|href|gs:\/\/|x-forwarded/i);
    expect(captured).toMatchObject({
      outputSchema: "grounded_blocks_v1",
      systemPolicyVersion: "assistant-policy-v1",
      locale: "ru",
    });
    const evidence = (captured as { evidence: unknown[] }).evidence[0] as Record<
      string,
      unknown
    >;
    expect(evidence).toMatchObject({
      evidenceKey: "E1",
      sourceTitle: "Safe Label",
      entityType: "article",
    });
    expect(evidence).not.toHaveProperty("href");
    expect(evidence).not.toHaveProperty("entityId");
    expect(evidence).not.toHaveProperty("versionId");
    expect(evidence).not.toHaveProperty("chunkId");
  });

  it("logs only safe operational fields without question answer evidence IP Origin", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const secretQ = "SECRET_QUESTION_PAYLOAD_xyz";
    const secretAnswer = "SECRET_ANSWER_PAYLOAD_xyz";
    const secretEvidence = "SECRET_EVIDENCE_PAYLOAD_xyz";
    const result = await askAssistant(
      {
        question: secretQ,
        requestId: "req_log",
        rateLimitKey: "assistant:log:127.0.0.1",
      },
      {
        retrieval: {
          retrieve: async () => ({
            status: "ok",
            sources: [
              {
                sourceId: "s1",
                entityType: "article",
                entityId: "a1",
                versionId: "v1",
                title: "Sensitive Title Maybe",
                href: "/articles/t",
                publishedAt: null,
                order: 0,
              },
            ],
            chunks: [
              {
                chunkId: "c1",
                sourceId: "s1",
                versionId: "v1",
                headingPath: "h",
                text: secretEvidence,
                ordinal: 0,
                characterCount: secretEvidence.length,
                trustBoundary: "published_content",
              },
            ],
            meta: {
              candidateCount: 1,
              scannedCount: 1,
              generationId: "g1",
            },
          }),
          revalidate: async () => ({ valid: true, invalidReferences: [] }),
        },
        provider: {
          generateGroundedAnswer: async () => ({
            kind: "answered",
            blocks: [{ text: secretAnswer, evidenceKeys: ["E1"] }],
            usage: {
              inputCharacters: 1,
              outputCharacters: secretAnswer.length,
              evidenceSourceCount: 1,
              evidenceChunkCount: 1,
            },
            finishReason: "completed",
            providerStatus: "ok",
          }),
        },
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 10 }),
      },
    );
    expect(result.body.status).toBe("answered");
    const logged = [...infoSpy.mock.calls, ...errorSpy.mock.calls]
      .map((c) => JSON.stringify(c))
      .join("\n");
    expect(logged).toContain("assistant.ask");
    expect(logged).not.toContain(secretQ);
    expect(logged).not.toContain(secretAnswer);
    expect(logged).not.toContain(secretEvidence);
    expect(logged).not.toMatch(/127\.0\.0\.1|Origin|http:\/\/evil/i);
    expect(logged).not.toMatch(/system policy|ASSISTANT_SYSTEM_POLICY/i);
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("sanitizes provider errors that embed question API key HTML", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const result = await askAssistant(
      {
        question: "User secret question about payroll",
        requestId: "req_err",
        rateLimitKey: "assistant:err",
      },
      {
        retrieval: {
          retrieve: async () => {
            throw new Error(
              "boom question=User secret question about payroll apiKey=sk-live-ABCDEF https://evil.example <script>x</script>\nInjected",
            );
          },
          revalidate: vi.fn(),
        },
        provider: new FakeAssistantProviderAdapter(),
        rateLimit: new InProcessAssistantRateLimitAdapter({ limit: 10 }),
      },
    );
    expect(result.httpStatus).toBe(503);
    expect(JSON.stringify(result.body)).not.toMatch(
      /payroll|sk-live|evil\.example|<script>|Injected/i,
    );
    const logged = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(logged).not.toMatch(/payroll|sk-live|evil\.example|<script>|Injected/i);
    errorSpy.mockRestore();
  });
});
