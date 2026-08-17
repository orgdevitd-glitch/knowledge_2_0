import { describe, expect, it } from "vitest";

import {
  ASSISTANT_SEARCH_HREF_QUERY_KEYS,
  assertSafeAssistantSearchHref,
} from "@/domain/assistant/search-fallback";
import { SEARCH_URL_PARAM_ORDER } from "@/features/search/url/search-url-state";

describe("assertSafeAssistantSearchHref", () => {
  it("allows only the public Search URL query keys", () => {
    expect([...ASSISTANT_SEARCH_HREF_QUERY_KEYS]).toEqual([...SEARCH_URL_PARAM_ORDER]);
  });

  it("accepts the Search pathname and allowed query strings", () => {
    expect(assertSafeAssistantSearchHref("/search")).toBe("/search");
    expect(assertSafeAssistantSearchHref("/search?q=test")).toBe("/search?q=test");
    expect(assertSafeAssistantSearchHref("/search?type=article")).toBe(
      "/search?type=article",
    );
    expect(assertSafeAssistantSearchHref("/search?q=test&category=cat")).toBe(
      "/search?q=test&category=cat",
    );
    expect(
      assertSafeAssistantSearchHref("/search?q=test&type=article&tag=t1&audience=a1"),
    ).toBe("/search?q=test&type=article&tag=t1&audience=a1");
    expect(assertSafeAssistantSearchHref("/search?cursor=abc")).toBe("/search?cursor=abc");

    const encoded = assertSafeAssistantSearchHref("/search?q=%D1%82%D0%B5%D1%81%D1%82");
    expect(encoded).toMatch(/^\/search\?q=/);
    expect(
      new URL(encoded ?? "", "https://knowledge.invalid").searchParams.get("q"),
    ).toBe("тест");
  });

  it("rejects prefix-only and normalized path tricks", () => {
    for (const href of [
      "/search/",
      "/search-evil",
      "/searchAnything",
      "/search/admin",
      "/search/../admin",
      "/search/%2e%2e/admin",
      "/search%2Fadmin",
      "/search%2fadmin",
    ]) {
      expect(assertSafeAssistantSearchHref(href), href).toBeNull();
    }
  });

  it("rejects absolute, protocol-relative, schemes, and foreign routes", () => {
    for (const href of [
      "//example.com/search",
      "//search",
      "https://example.com/search",
      "http://example.com/search",
      "javascript:alert(1)",
      "/admin",
      "/api/search",
      "/assistant",
    ]) {
      expect(assertSafeAssistantSearchHref(href), href).toBeNull();
    }
  });

  it("rejects backslash, controls, malformed percent, and hash", () => {
    expect(assertSafeAssistantSearchHref("/search\\admin")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search?q=a\\b")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search\u0000")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search?q=a\u0007b")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search?q=%zz")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search?q=%")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search#search-results")).toBeNull();
    expect(assertSafeAssistantSearchHref("/search?q=test#x")).toBeNull();
  });

  it("rejects unknown assistant/provider/system query parameters", () => {
    for (const href of [
      "/search?provider=fake",
      "/search?model=gpt",
      "/search?assistant=1",
      "/search?system=1",
      "/search?q=test&provider=openai",
      "/search?type=all",
    ]) {
      expect(assertSafeAssistantSearchHref(href), href).toBeNull();
    }
  });
});
