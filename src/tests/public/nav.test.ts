import { describe, expect, it } from "vitest";

import {
  PUBLIC_NAV_ITEMS,
  buildPublicNavItems,
  resolveActiveNavId,
} from "@/features/public-content/nav";

describe("public navigation Search item", () => {
  it("includes a single Search link to /search", () => {
    const searchItems = PUBLIC_NAV_ITEMS.filter((item) => item.id === "search");
    expect(searchItems).toEqual([{ id: "search", label: "Поиск", href: "/search" }]);
    expect(PUBLIC_NAV_ITEMS.filter((item) => item.href === "/search")).toHaveLength(1);
    expect(PUBLIC_NAV_ITEMS.some((item) => item.id === "assistant")).toBe(false);
  });

  it("keeps existing primary items", () => {
    expect(PUBLIC_NAV_ITEMS.map((item) => item.id)).toEqual([
      "home",
      "materials",
      "articles",
      "prompts",
      "search",
    ]);
  });

  it("resolves Search active state without highlighting materials", () => {
    expect(resolveActiveNavId("/search")).toBe("search");
    expect(resolveActiveNavId("/search?q=test")).toBe("search");
    expect(resolveActiveNavId("/search?q=x")).toBe("search");
    expect(resolveActiveNavId("/search?type=article")).toBe("search");
    expect(resolveActiveNavId("/materials")).toBe("materials");
    expect(resolveActiveNavId("/articles")).toBe("articles");
    expect(resolveActiveNavId("/prompts")).toBe("prompts");
    expect(resolveActiveNavId("/")).toBe("home");
  });

  it("does not treat prefix collisions as Search or materials", () => {
    expect(resolveActiveNavId("/search")).not.toBe("materials");
    expect(resolveActiveNavId("/assistant")).not.toBe("search");
    expect(resolveActiveNavId("/assistant")).toBe("assistant");
    expect(resolveActiveNavId("/articles/getting-started-portal")).toBe("articles");
    expect(resolveActiveNavId("/articles/getting-started-portal")).not.toBe(
      "materials",
    );
    expect(resolveActiveNavId("/prompts/demo-summarize-text")).toBe("prompts");
    expect(resolveActiveNavId("/prompts/demo-summarize-text")).not.toBe("materials");
  });

  it("keeps assistant conditional", () => {
    expect(
      buildPublicNavItems({ assistantAvailable: false }).some((i) => i.id === "assistant"),
    ).toBe(false);
    expect(resolveActiveNavId("/assistant")).toBe("assistant");
    const enabled = buildPublicNavItems({ assistantAvailable: true });
    expect(enabled.filter((i) => i.id === "assistant")).toHaveLength(1);
    expect(enabled.filter((i) => i.id === "search")).toHaveLength(1);
  });
});
