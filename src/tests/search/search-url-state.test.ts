import { describe, expect, it } from "vitest";

import {
  applySearchUrlPatch,
  buildSearchHref,
  canonicalizeSearchParams,
  clearSearchFilters,
  clearSearchQuery,
  parseSearchUrlState,
  removeSearchFilter,
  serializeSearchUrlState,
} from "@/features/search/url/search-url-state";

describe("search URL state", () => {
  it("parses known params and ignores unknown", () => {
    const state = parseSearchUrlState(
      new URLSearchParams(
        "q=hello&type=article&category=c1&tag=t1&audience=a1&cursor=cur&foo=bar",
      ),
    );
    expect(state).toEqual({
      q: "hello",
      type: "article",
      category: "c1",
      tag: "t1",
      audience: "a1",
      cursor: "cur",
    });
  });

  it("serializes in canonical order and drops empties", () => {
    const qs = serializeSearchUrlState({
      q: "  x  ",
      type: "prompt",
      category: null,
      tag: "t1",
      audience: "",
      cursor: null,
    });
    expect(qs).toBe("q=x&type=prompt&tag=t1");
    expect([...new URLSearchParams(qs).keys()]).toEqual(["q", "type", "tag"]);
  });

  it("resets cursor when q changes", () => {
    const next = applySearchUrlPatch(
      {
        q: "a",
        type: null,
        category: null,
        tag: null,
        audience: null,
        cursor: "c",
      },
      { q: "b" },
    );
    expect(next.cursor).toBeNull();
    expect(next.q).toBe("b");
  });

  it("resets cursor when each filter changes", () => {
    const base = {
      q: "q",
      type: "article" as const,
      category: "c",
      tag: "t",
      audience: "a",
      cursor: "cur",
    };
    expect(applySearchUrlPatch(base, { type: "prompt" }).cursor).toBeNull();
    expect(applySearchUrlPatch(base, { category: "c2" }).cursor).toBeNull();
    expect(applySearchUrlPatch(base, { tag: "t2" }).cursor).toBeNull();
    expect(applySearchUrlPatch(base, { audience: "a2" }).cursor).toBeNull();
  });

  it("clear one filter preserves q and other filters, drops cursor", () => {
    const next = removeSearchFilter(
      {
        q: "q",
        type: "article",
        category: "c",
        tag: "t",
        audience: "a",
        cursor: "cur",
      },
      "tag",
    );
    expect(next).toEqual({
      q: "q",
      type: "article",
      category: "c",
      tag: null,
      audience: "a",
      cursor: null,
    });
  });

  it("clear all filters preserves q", () => {
    expect(
      clearSearchFilters({
        q: "keep",
        type: "article",
        category: "c",
        tag: "t",
        audience: "a",
        cursor: "cur",
      }),
    ).toEqual({
      q: "keep",
      type: null,
      category: null,
      tag: null,
      audience: null,
      cursor: null,
    });
  });

  it("clear q preserves filters and drops cursor", () => {
    expect(
      clearSearchQuery({
        q: "gone",
        type: "prompt",
        category: "c",
        tag: null,
        audience: null,
        cursor: "cur",
      }),
    ).toEqual({
      q: "",
      type: "prompt",
      category: "c",
      tag: null,
      audience: null,
      cursor: null,
    });
  });

  it("buildSearchHref is shareable and supports hash", () => {
    expect(
      buildSearchHref(
        {
          q: "a b",
          type: "article",
          category: "c1",
          tag: null,
          audience: null,
          cursor: "cur",
        },
        { hash: "search-results" },
      ),
    ).toBe("/search?q=a+b&type=article&category=c1&cursor=cur#search-results");
  });

  it("canonicalize drops unknown params", () => {
    const out = canonicalizeSearchParams(
      new URLSearchParams("q=x&utm=1&type=article"),
    );
    expect(out.toString()).toBe("q=x&type=article");
  });
});
