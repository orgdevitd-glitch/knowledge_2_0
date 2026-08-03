import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildSearchHref,
  clearSearchFilters,
  parseSearchUrlState,
} from "@/features/search/url/search-url-state";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";

const ROOT = join(process.cwd(), "src");

describe("search experience page contract helpers", () => {
  it("builds honest pagination URLs", () => {
    const state = parseSearchUrlState({
      q: "ops",
      type: "article",
      category: "c1",
      cursor: "old",
    });
    expect(
      buildSearchHref(
        { ...state, cursor: "next" },
        { hash: "search-results" },
      ),
    ).toBe(
      "/search?q=ops&type=article&category=c1&cursor=next#search-results",
    );
    expect(
      buildSearchHref({ ...state, cursor: null }, { hash: "search-results" }),
    ).toBe("/search?q=ops&type=article&category=c1#search-results");
    expect(buildSearchHref(clearSearchFilters(state))).toBe("/search?q=ops");
  });

  it("search page keeps SSR application service call and experience markers", () => {
    const page = readFileSync(
      join(ROOT, "app", "(public)", "search", "page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/executePublicSearch/);
    expect(page).toMatch(/Показано материалов на этой странице/);
    expect(page).toMatch(/search-results/);
    expect(page).toMatch(/Показать актуальные результаты/);
    expect(page).toMatch(/Поиск временно недоступен/);
    expect(page).toMatch(/Недоступный фильтр|unavailable/);
    expect(page).not.toMatch(/fetch\(["'`]\/api\/search/);
    expect(page).not.toMatch(/Найдено \d/);
  });

  it("header/layout pass runtime queryMaxLength props (no NEXT_PUBLIC search limits)", () => {
    const layout = readFileSync(
      join(ROOT, "app", "(public)", "layout.tsx"),
      "utf8",
    );
    const header = readFileSync(
      join(ROOT, "features", "public-content", "ui", "header-search.tsx"),
      "utf8",
    );
    expect(layout).toMatch(/getPublicSearchUiLimits|queryMaxLength/);
    expect(header).toMatch(/queryMaxLength/);
    expect(header).not.toMatch(/NEXT_PUBLIC_.*SEARCH/);
    expect(header).not.toMatch(/SEARCH_LIMIT_DEFAULTS\.queryMaxLength/);
  });

  it("combobox module has no module-level mutable timers/controllers", () => {
    const text = readFileSync(
      join(ROOT, "features", "search", "ui", "search-input-with-suggestions.tsx"),
      "utf8",
    );
    expect(text).toMatch(/useRef/);
    expect(text).toMatch(/requestSeqRef|requestIdRef/);
    expect(text).not.toMatch(/^let (debounce|abort|controller)/m);
  });

  it("suggestions route is private no-store force-dynamic", () => {
    const route = readFileSync(
      join(ROOT, "app", "api", "search", "suggestions", "route.ts"),
      "utf8",
    );
    expect(route).toMatch(/force-dynamic/);
    expect(route).toMatch(/no-store/);
    expect(route).toMatch(/publicSearchSuggestionsLimiter/);
    expect(route).not.toMatch(/searchableText|gs:\/\//);
  });

  it("does not change SearchDocument schema version", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
  });
});
