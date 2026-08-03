import { describe, expect, it } from "vitest";

import { isSafePublicSearchHref } from "@/domain/search/search-href";

describe("isSafePublicSearchHref", () => {
  it("accepts valid Article and Prompt hrefs", () => {
    expect(isSafePublicSearchHref("/articles/onboarding-guide")).toBe(true);
    expect(isSafePublicSearchHref("/prompts/careful-prompt")).toBe(true);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(isSafePublicSearchHref("https://evil.example/articles/x")).toBe(
      false,
    );
    expect(isSafePublicSearchHref("//evil.example/articles/x")).toBe(false);
  });

  it("rejects javascript and other schemes", () => {
    expect(isSafePublicSearchHref("javascript:alert(1)")).toBe(false);
    expect(isSafePublicSearchHref("data:text/html,hi")).toBe(false);
    expect(isSafePublicSearchHref("file:///etc/passwd")).toBe(false);
  });

  it("rejects traversal, backslash, controls, query, fragment", () => {
    expect(isSafePublicSearchHref("/articles/../admin")).toBe(false);
    expect(isSafePublicSearchHref("/articles/%2e%2e/admin")).toBe(false);
    expect(isSafePublicSearchHref("/articles/foo\\bar")).toBe(false);
    expect(isSafePublicSearchHref("/articles/foo\nbar")).toBe(false);
    expect(isSafePublicSearchHref("/articles/foo?x=1")).toBe(false);
    expect(isSafePublicSearchHref("/articles/foo#x")).toBe(false);
  });

  it("rejects admin, api, empty slug, malformed slug", () => {
    expect(isSafePublicSearchHref("/admin/search")).toBe(false);
    expect(isSafePublicSearchHref("/api/search")).toBe(false);
    expect(isSafePublicSearchHref("/articles/")).toBe(false);
    expect(isSafePublicSearchHref("/articles/Bad_Slug")).toBe(false);
    expect(isSafePublicSearchHref("/articles/-bad")).toBe(false);
  });
});
