import { describe, expect, it } from "vitest";

import {
  PUBLIC_NAV_ITEMS,
  buildPublicNavItems,
  resolveActiveNavId,
} from "@/features/public-content/nav";

describe("public navigation assistant item", () => {
  it("does not include assistant in the static always-on list", () => {
    expect(PUBLIC_NAV_ITEMS.some((item) => item.id === "assistant")).toBe(
      false,
    );
    expect(PUBLIC_NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/materials",
      "/articles",
      "/prompts",
    ]);
  });

  it("adds assistant only when available", () => {
    const hidden = buildPublicNavItems({ assistantAvailable: false });
    expect(hidden.some((item) => item.id === "assistant")).toBe(false);
    expect(hidden).toHaveLength(PUBLIC_NAV_ITEMS.length);

    const shown = buildPublicNavItems({ assistantAvailable: true });
    const assistant = shown.find((item) => item.id === "assistant");
    expect(assistant).toEqual({
      id: "assistant",
      label: "Ассистент",
      href: "/assistant",
    });
    expect(shown).toHaveLength(PUBLIC_NAV_ITEMS.length + 1);
  });

  it("does not mutate the static nav array", () => {
    const snapshot = PUBLIC_NAV_ITEMS.map((i) => ({ ...i }));
    buildPublicNavItems({ assistantAvailable: true });
    expect(PUBLIC_NAV_ITEMS).toEqual(snapshot);
  });

  it("is pure across repeated and interleaved calls", () => {
    expect(buildPublicNavItems({ assistantAvailable: false }).some((i) => i.id === "assistant")).toBe(false);
    expect(buildPublicNavItems({ assistantAvailable: false }).some((i) => i.id === "assistant")).toBe(false);
    expect(buildPublicNavItems({ assistantAvailable: true }).filter((i) => i.id === "assistant")).toHaveLength(1);
    expect(buildPublicNavItems({ assistantAvailable: false }).some((i) => i.id === "assistant")).toBe(false);
    expect(buildPublicNavItems({ assistantAvailable: true }).filter((i) => i.id === "assistant")).toHaveLength(1);

    const enabled = buildPublicNavItems({ assistantAvailable: true });
    const disabled = buildPublicNavItems({ assistantAvailable: false });
    enabled.push({ id: "injected", label: "X", href: "/x" });
    expect(buildPublicNavItems({ assistantAvailable: true }).some((i) => i.id === "injected")).toBe(false);
    expect(disabled.some((i) => i.id === "assistant")).toBe(false);
    expect(PUBLIC_NAV_ITEMS.some((i) => i.id === "assistant" || i.id === "injected")).toBe(false);
  });

  it("resolves /assistant as active without regressing other routes", () => {
    expect(resolveActiveNavId("/assistant")).toBe("assistant");
    expect(resolveActiveNavId("/assistant/")).toBe("assistant");
    expect(resolveActiveNavId("/")).toBe("home");
    expect(resolveActiveNavId("/articles/hello")).toBe("articles");
    expect(resolveActiveNavId("/prompts/p")).toBe("prompts");
    expect(resolveActiveNavId("/materials")).toBe("materials");
    expect(resolveActiveNavId("/search")).toBe("materials");
  });
});
