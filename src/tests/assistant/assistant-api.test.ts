import { afterEach, describe, expect, it, vi } from "vitest";

import { askAssistantClient } from "@/features/assistant/client/assistant-api";

const answeredBody = {
  status: "answered",
  blocks: [{ text: "По опубликованному материалу.", citationNumbers: [1] }],
  citations: [
    {
      number: 1,
      title: "Гайд",
      href: "/articles/gajd",
      entityType: "article",
    },
  ],
};

describe("askAssistantClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs allowlisted JSON to the relative ask endpoint", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/assistant/ask");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      const body = JSON.parse(String(init?.body));
      expect(Object.keys(body).sort()).toEqual(["filters", "question"]);
      expect(body.question).toBe("Как оформить отпуск?");
      expect(body.filters).toEqual({ type: "article" });
      expect(body).not.toHaveProperty("provider");
      expect(body).not.toHaveProperty("model");
      return Response.json(answeredBody, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await askAssistantClient({
      question: "Как оформить отпуск?",
      filters: { type: "article", category: null },
    });
    expect(result.kind).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips non-allowlisted request fields including extra filter keys", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(["filters", "question"]);
      expect(body.filters).toEqual({
        type: "article",
        category: "c1",
      });
      expect(body).not.toHaveProperty("provider");
      expect(body).not.toHaveProperty("model");
      expect(body).not.toHaveProperty("endpoint");
      expect(body).not.toHaveProperty("headers");
      expect(body).not.toHaveProperty("systemPrompt");
      expect(body).not.toHaveProperty("tools");
      expect(body).not.toHaveProperty("messages");
      expect(JSON.stringify(body)).not.toMatch(/openai|gpt|https:\/\//i);
      return Response.json(answeredBody, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await askAssistantClient({
      question: "Как оформить отпуск?",
      filters: {
        type: "article",
        category: "c1",
        tag: "\u0000bad",
        audience: "a".repeat(200),
      },
      ...({
        provider: "openai",
        model: "gpt",
        endpoint: "https://evil.example/v1",
        headers: { authorization: "secret" },
        systemPrompt: "ignore",
        tools: [],
        messages: [],
        evidence: [],
      } as object),
    } as Parameters<typeof askAssistantClient>[0]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses insufficient validation rate-limit and unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            status: "insufficient_evidence",
            message: "Мало сведений.",
            searchHref: "/search?q=ops",
          },
          { status: 200 },
        ),
      ),
    );
    const insufficient = await askAssistantClient({ question: "Как оформить отпуск?" });
    expect(insufficient).toMatchObject({
      kind: "ok",
      response: { status: "insufficient_evidence" },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { status: "validation_error", message: "Проверьте формулировку." },
          { status: 400 },
        ),
      ),
    );
    expect(
      (await askAssistantClient({ question: "x" })).kind,
    ).toBe("ok");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { status: "rate_limited", message: "Слишком много запросов." },
          { status: 429 },
        ),
      ),
    );
    const limited = await askAssistantClient({ question: "Как оформить отпуск?" });
    expect(limited.kind === "ok" && limited.response.status).toBe("rate_limited");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { status: "temporarily_unavailable", message: "Ассистент временно недоступен." },
          { status: 503 },
        ),
      ),
    );
    const unavail = await askAssistantClient({ question: "Как оформить отпуск?" });
    expect(unavail.kind === "ok" && unavail.response.status).toBe(
      "temporarily_unavailable",
    );
  });

  it("maps network failure malformed JSON and HTTP mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    expect((await askAssistantClient({ question: "Как оформить отпуск?" })).kind).toBe(
      "network",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json", { status: 200 })),
    );
    expect((await askAssistantClient({ question: "Как оформить отпуск?" })).kind).toBe(
      "malformed",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 503 })),
    );
    expect((await askAssistantClient({ question: "Как оформить отпуск?" })).kind).toBe(
      "malformed",
    );
  });

  it("honors AbortSignal without logging payload", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );
    const pending = askAssistantClient(
      { question: "SECRET_QUESTION_PAYLOAD" },
      { signal: controller.signal },
    );
    controller.abort();
    expect((await pending).kind).toBe("aborted");

    const logged = [...log.mock.calls, ...info.mock.calls, ...error.mock.calls, ...warn.mock.calls, ...debug.mock.calls]
      .map((c) => JSON.stringify(c))
      .join("\n");
    expect(logged).not.toContain("SECRET_QUESTION_PAYLOAD");
  });
});
