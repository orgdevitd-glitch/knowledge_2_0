import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST, GET, dynamic } from "@/app/api/assistant/ask/route";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  createArticleUseCase,
  publishArticle,
} from "@/features/content/application/article-use-cases";
import { indexAfterArticlePublish } from "@/features/search/application/indexing-service";
import { paragraphBlock, testCtx } from "@/tests/builders/content";
import { logger } from "@/lib/logger";
import { assistantAskHeaders, resetAssistantTestEnv } from "./helpers";
import {
  getAssistantRateLimiterForTests,
} from "@/server/assistant/rate-limit";

describe("POST /api/assistant/ask", () => {
  beforeEach(() => {
    resetAssistantTestEnv("fake");
  });

  async function seedArticle() {
    const ports = getContentPorts();
    const ctx = testCtx();
    const article = await createArticleUseCase(ports, ctx, {
      slug: "api-policy",
      title: "API Policy Document",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "API политика описывает доступ")],
    });
    const pub = await publishArticle(ports, ctx, article.id, article.revision);
    await indexAfterArticlePublish({
      ports,
      articleId: article.id as string,
      versionId: pub.versionId,
    });
    return article;
  }

  it("is force-dynamic POST-only and returns no-store answered DTO", async () => {
    expect(dynamic).toBe("force-dynamic");
    await seedArticle();
    const logSpy = vi.spyOn(logger, "info");
    const res = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: JSON.stringify({
          question: "API Policy Document доступ",
          filters: { type: "article" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
    const body = await res.json();
    expect(body.status).toBe("answered");
    expect(body.citations[0].href).toBe("/articles/api-policy");
    expect(JSON.stringify(body)).not.toMatch(
      /versionId|chunkId|provider|model|systemPrompt|stack/i,
    );
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/API Policy Document доступ/);
    }
    logSpy.mockRestore();

    const getRes = await GET();
    expect(getRes.status).toBe(405);
  });

  it("rejects bad content-type origin cross-site forbidden fields and oversized body", async () => {
    const noJson = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders({ "content-type": "text/plain" }),
        body: "x",
      }),
    );
    expect(noJson.status).toBe(415);

    const cross = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders({ origin: "https://evil.example" }),
        body: JSON.stringify({ question: "API Policy Document" }),
      }),
    );
    expect(cross.status).toBe(403);

    const crossSite = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders({ "sec-fetch-site": "cross-site" }),
        body: JSON.stringify({ question: "API Policy Document" }),
      }),
    );
    expect(crossSite.status).toBe(403);

    for (const field of [
      "systemPrompt",
      "evidence",
      "tools",
      "messages",
      "model",
      "provider",
    ]) {
      const res = await POST(
        new Request("http://localhost/api/assistant/ask", {
          method: "POST",
          headers: assistantAskHeaders(),
          body: JSON.stringify({
            question: "API Policy Document",
            [field]: "nope",
          }),
        }),
      );
      expect(res.status).toBe(400);
    }

    const huge = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: {
          ...assistantAskHeaders(),
          "content-length": "999999",
        },
        body: JSON.stringify({ question: "API Policy Document" }),
      }),
    );
    expect(huge.status).toBe(413);
  });

  it("validates empty short long malformed JSON and unknown filter fields", async () => {
    const empty = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: JSON.stringify({ question: "" }),
      }),
    );
    expect(empty.status).toBe(400);

    const short = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: JSON.stringify({ question: "ab" }),
      }),
    );
    expect(short.status).toBe(400);

    const long = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: JSON.stringify({ question: "x".repeat(2001) }),
      }),
    );
    expect(long.status).toBe(400);

    const malformed = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);

    const unknown = await POST(
      new Request("http://localhost/api/assistant/ask", {
        method: "POST",
        headers: assistantAskHeaders(),
        body: JSON.stringify({
          question: "API Policy Document",
          filters: { type: "article", unknown: "x" },
        }),
      }),
    );
    expect(unknown.status).toBe(400);
  });

  it("rate limits", async () => {
    await seedArticle();
    const limiter = getAssistantRateLimiterForTests();
    limiter.clearForTests();
    // Rebuild with tiny limit by resetting env — use many requests against default 10
    const ip = `api-rl-${Date.now()}`;
    let hit = false;
    for (let i = 0; i < 30; i += 1) {
      const res = await POST(
        new Request("http://localhost/api/assistant/ask", {
          method: "POST",
          headers: assistantAskHeaders({ "x-forwarded-for": ip }),
          body: JSON.stringify({ question: "API Policy Document" }),
        }),
      );
      if (res.status === 429) {
        hit = true;
        const body = await res.json();
        expect(body.status).toBe("rate_limited");
        break;
      }
    }
    expect(hit).toBe(true);
  });
});
