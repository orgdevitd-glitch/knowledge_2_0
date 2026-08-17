import { describe, expect, it } from "vitest";

import { parseSlug } from "@/domain/shared/value-objects";
import {
  catalogFilterHref,
  catalogFilterSearchParams,
  parseCatalogSlug,
  taxonomyCatalogHref,
} from "@/features/public-content/catalog-url";
import { buildSearchHref } from "@/features/search/url/search-url-state";

describe("catalog URL safety", () => {
  it("builds shareable internal catalog hrefs from allowlisted params", () => {
    expect(catalogFilterHref("/materials", { tag: "demo-onboarding" })).toBe(
      "/materials?tag=demo-onboarding",
    );
    expect(
      catalogFilterHref("/materials", {
        category: "demo-guides",
        tag: "demo-onboarding",
      }),
    ).toBe("/materials?category=demo-guides&tag=demo-onboarding");
    expect(catalogFilterHref("/articles", { tag: "demo-tools", page: 1 })).toBe(
      "/articles?tag=demo-tools",
    );
    expect(catalogFilterHref("/articles", { tag: "demo-tools", page: 2 })).toBe(
      "/articles?tag=demo-tools&page=2",
    );
    expect(
      catalogFilterHref("/materials", {
        type: "article",
        tag: "demo-tools",
        sort: "title-asc",
        q: "онбординг",
      }),
    ).toBe(
      "/materials?type=article&tag=demo-tools&sort=title-asc&q=%D0%BE%D0%BD%D0%B1%D0%BE%D1%80%D0%B4%D0%B8%D0%BD%D0%B3",
    );
  });

  it("reuses the domain slug contract and drops malformed values", () => {
    expect(parseCatalogSlug("demo-onboarding")).toBe(parseSlug("demo-onboarding"));
    expect(parseCatalogSlug("  demo-onboarding  ")).toBe("demo-onboarding");
    expect(parseCatalogSlug("")).toBeNull();
    expect(parseCatalogSlug("   ")).toBeNull();
    expect(parseCatalogSlug("Demo-Onboarding")).toBeNull();
    expect(parseCatalogSlug("demo_tag_start")).toBeNull();
    expect(parseCatalogSlug("a--b")).toBeNull();
    expect(parseCatalogSlug("a.")).toBeNull();
    expect(parseCatalogSlug("javascript:alert(1)")).toBeNull();
    expect(parseCatalogSlug("../etc")).toBeNull();
    expect(parseCatalogSlug("foo\\bar")).toBeNull();
    expect(parseCatalogSlug("foo/bar")).toBeNull();
    expect(parseCatalogSlug("%2F")).toBeNull();
    expect(parseCatalogSlug("%00")).toBeNull();
    expect(parseCatalogSlug("\0")).toBeNull();
    expect(parseCatalogSlug("%zz")).toBeNull();
    expect(parseCatalogSlug("a".repeat(97))).toBeNull();
    expect(parseCatalogSlug("a".repeat(96))).toBe("a".repeat(96));
  });

  it("rejects open redirects and does not accept an arbitrary href", () => {
    expect(catalogFilterHref("https://evil.example", { tag: "x" })).toBe(
      "/materials?tag=x",
    );
    expect(catalogFilterHref("//evil.example", { tag: "ok-tag" })).toBe(
      "/materials?tag=ok-tag",
    );
    expect(taxonomyCatalogHref("tag", { slug: "ok-tag", status: "active" })).toBe(
      "/materials?tag=ok-tag",
    );
    expect(
      taxonomyCatalogHref("tag", { slug: "ok-tag", status: "archived" }),
    ).toBeNull();
    expect(
      taxonomyCatalogHref("category", {
        slug: "demo-guides",
        status: "active",
      }),
    ).toBe("/materials?category=demo-guides");
    expect(
      taxonomyCatalogHref("audience", {
        slug: "demo-all-staff",
        status: "active",
      }),
    ).toBe("/materials?audience=demo-all-staff");
  });

  it("uses set() so duplicate query keys are not emitted", () => {
    const params = catalogFilterSearchParams({
      tag: "demo-onboarding",
      category: "demo-guides",
    });
    expect([...params.keys()]).toEqual(["category", "tag"]);
    expect(params.getAll("tag")).toEqual(["demo-onboarding"]);
  });

  it("keeps catalog tag slugs distinct from Search tag IDs", () => {
    expect(catalogFilterHref("/materials", { tag: "demo-onboarding" })).toBe(
      "/materials?tag=demo-onboarding",
    );
    expect(parseCatalogSlug("demo_tag_start")).toBeNull();
    expect(
      buildSearchHref({
        q: "",
        type: null,
        category: null,
        tag: "demo_tag_start",
        audience: null,
        cursor: null,
      }),
    ).toBe("/search?tag=demo_tag_start");
  });

  it("resets pagination when building a new filter href", () => {
    const params = catalogFilterSearchParams({
      category: "demo-guides",
      tag: "demo-onboarding",
      page: 4,
    });
    expect(params.get("page")).toBe("4");
    expect(
      catalogFilterHref("/materials", {
        category: "demo-guides",
        tag: "demo-onboarding",
      }),
    ).not.toContain("page=");
  });
});
