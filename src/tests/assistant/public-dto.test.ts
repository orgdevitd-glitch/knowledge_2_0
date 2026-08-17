import { describe, expect, it } from "vitest";

import { parseAssistantPublicResponse } from "@/features/assistant/client/public-dto";

const answered = {
  status: "answered" as const,
  blocks: [
    { text: "По опубликованному материалу.", citationNumbers: [1] },
  ],
  citations: [
    {
      number: 1,
      title: "Гайд",
      href: "/articles/gajd",
      entityType: "article" as const,
      excerpt: "Фрагмент",
    },
  ],
};

describe("assistant public DTO parser", () => {
  it("accepts answered 200 with safe hrefs", () => {
    const parsed = parseAssistantPublicResponse(200, answered);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.response.status).toBe("answered");
    }
  });

  it("accepts insufficient 200 and drops unsafe searchHref", () => {
    const parsed = parseAssistantPublicResponse(200, {
      status: "insufficient_evidence",
      message: "Мало сведений в материалах.",
      searchHref: "https://evil.example/search",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.response.status === "insufficient_evidence") {
      expect(parsed.response.searchHref).toBeUndefined();
    }

    const safe = parseAssistantPublicResponse(200, {
      status: "insufficient_evidence",
      message: "Мало сведений в материалах.",
      searchHref: "/search?q=ops",
    });
    expect(safe.ok).toBe(true);
    if (safe.ok && safe.response.status === "insufficient_evidence") {
      expect(safe.response.searchHref).toBe("/search?q=ops");
    }
  });

  it("rejects HTTP/body mismatch", () => {
    expect(parseAssistantPublicResponse(503, answered).ok).toBe(false);
    expect(
      parseAssistantPublicResponse(200, {
        status: "rate_limited",
        message: "Слишком много запросов.",
      }).ok,
    ).toBe(false);
    expect(
      parseAssistantPublicResponse(429, answered).ok,
    ).toBe(false);
    expect(parseAssistantPublicResponse(503, answered).ok).toBe(false);
    expect(
      parseAssistantPublicResponse(400, {
        status: "insufficient_evidence",
        message: "Мало сведений в материалах.",
      }).ok,
    ).toBe(false);
    expect(
      parseAssistantPublicResponse(500, {
        status: "temporarily_unavailable",
        message: "Ассистент временно недоступен.",
      }).ok,
    ).toBe(false);
    expect(
      parseAssistantPublicResponse(200, {
        status: "unknown_status",
        message: "ignore",
      }).ok,
    ).toBe(false);
    expect(
      parseAssistantPublicResponse(429, {
        status: "temporarily_unavailable",
        message: "Ассистент временно недоступен.",
      }).ok,
    ).toBe(false);
  });

  it("rejects oversized grounded structures fail-closed", () => {
    const tooManyCitations = {
      status: "answered",
      blocks: [{ text: "Текст.", citationNumbers: Array.from({ length: 9 }, (_, i) => i + 1) }],
      citations: Array.from({ length: 9 }, (_, i) => ({
        number: i + 1,
        title: "T",
        href: `/articles/gajd-${i + 1}`,
        entityType: "article" as const,
      })),
    };
    expect(parseAssistantPublicResponse(200, tooManyCitations).ok).toBe(false);

    const tooManyBlocks = {
      status: "answered",
      blocks: Array.from({ length: 21 }, () => ({
        text: "Текст.",
        citationNumbers: [1],
      })),
      citations: answered.citations,
    };
    expect(parseAssistantPublicResponse(200, tooManyBlocks).ok).toBe(false);

    const longText = {
      status: "answered",
      blocks: [{ text: "я".repeat(20_001), citationNumbers: [1] }],
      citations: answered.citations,
    };
    expect(parseAssistantPublicResponse(200, longText).ok).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(
      parseAssistantPublicResponse(200, {
        ...answered,
        policyVersion: "assistant-policy-v1",
      }).ok,
    ).toBe(false);
  });

  it("rejects unsafe citation hrefs fail-closed", () => {
    for (const href of [
      "https://evil.example/articles/x",
      "//evil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      "/admin/articles/x",
      "/api/assistant/ask",
      "/search",
      "/assistant",
      "/articles/../prompts/x",
      "/articles/%2e%2e/x",
      "/articles/x\\y",
      "/articles/x\u0000y",
      "/articles/%zz",
      "/articles/valid?x=1",
    ]) {
      expect(
        parseAssistantPublicResponse(200, {
          status: "answered",
          blocks: [{ text: "Текст.", citationNumbers: [1] }],
          citations: [
            {
              number: 1,
              title: "X",
              href,
              entityType: "article",
            },
          ],
        }).ok,
      ).toBe(false);
    }
    expect(
      parseAssistantPublicResponse(200, {
        status: "answered",
        blocks: [{ text: "Текст.", citationNumbers: [1] }],
        citations: [
          {
            number: 1,
            title: "X",
            href: "/articles/gajd",
            entityType: "article",
          },
        ],
      }).ok,
    ).toBe(true);
    expect(
      parseAssistantPublicResponse(200, {
        status: "answered",
        blocks: [{ text: "Текст.", citationNumbers: [1] }],
        citations: [
          {
            number: 1,
            title: "X",
            href: "/prompts/gajd",
            entityType: "prompt",
          },
        ],
      }).ok,
    ).toBe(true);
  });

  it("rejects missing orphan and duplicate citation numbers", () => {
    expect(
      parseAssistantPublicResponse(200, {
        status: "answered",
        blocks: [{ text: "Текст.", citationNumbers: [2] }],
        citations: answered.citations,
      }).ok,
    ).toBe(false);

    expect(
      parseAssistantPublicResponse(200, {
        status: "answered",
        blocks: [{ text: "Текст.", citationNumbers: [1] }],
        citations: [
          ...answered.citations,
          {
            number: 2,
            title: "Другой",
            href: "/articles/other",
            entityType: "article",
          },
        ],
      }).ok,
    ).toBe(false);

    expect(
      parseAssistantPublicResponse(200, {
        status: "answered",
        blocks: [{ text: "Текст.", citationNumbers: [1] }],
        citations: [
          answered.citations[0],
          {
            number: 1,
            title: "Дубль",
            href: "/articles/dup",
            entityType: "article",
          },
        ],
      }).ok,
    ).toBe(false);
  });

  it("maps validation statuses", () => {
    for (const http of [400, 403, 413, 415]) {
      const parsed = parseAssistantPublicResponse(http, {
        status: "validation_error",
        message: "Не удалось обработать запрос.",
      });
      expect(parsed.ok).toBe(true);
    }
  });

  it("keeps insufficient state while dropping invalid searchHref", () => {
    for (const searchHref of [
      "https://evil.example/search",
      "//evil.example/search",
      "javascript:alert(1)",
      "/admin",
      "/api/search",
      "/search-evil",
      "/search/../admin",
      "/search?provider=fake",
    ]) {
      const parsed = parseAssistantPublicResponse(200, {
        status: "insufficient_evidence",
        message: "Мало сведений в материалах.",
        searchHref,
      });
      expect(parsed.ok).toBe(true);
      if (parsed.ok && parsed.response.status === "insufficient_evidence") {
        expect(parsed.response.searchHref).toBeUndefined();
        expect(parsed.response.message).toBe("Мало сведений в материалах.");
      }
    }

    const bare = parseAssistantPublicResponse(200, {
      status: "insufficient_evidence",
      message: "Мало сведений в материалах.",
      searchHref: "/search",
    });
    expect(bare.ok).toBe(true);
    if (bare.ok && bare.response.status === "insufficient_evidence") {
      expect(bare.response.searchHref).toBe("/search");
    }
  });
});
