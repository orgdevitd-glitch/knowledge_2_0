import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_ITEMS,
  isAdminSignInPath,
  resolveActiveAdminNavId,
} from "@/features/admin/nav";

describe("admin navigation", () => {
  it("exposes the content-operations sections", () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.id)).toEqual([
      "home",
      "articles",
      "prompts",
      "media",
      "taxonomy",
      "import",
      "search",
    ]);
  });

  it("resolves active states by prefix except home", () => {
    expect(resolveActiveAdminNavId("/admin")).toBe("home");
    expect(resolveActiveAdminNavId("/admin/")).toBe("home");
    expect(resolveActiveAdminNavId("/admin/articles")).toBe("articles");
    expect(resolveActiveAdminNavId("/admin/articles/new")).toBe("articles");
    expect(resolveActiveAdminNavId("/admin/articles/a1")).toBe("articles");
    expect(resolveActiveAdminNavId("/admin/prompts/p1/edit")).toBe("prompts");
    expect(resolveActiveAdminNavId("/admin/media/m1")).toBe("media");
    expect(resolveActiveAdminNavId("/admin/taxonomy/tags")).toBe("taxonomy");
    expect(resolveActiveAdminNavId("/admin/integrations/google")).toBe("import");
    expect(resolveActiveAdminNavId("/admin/search")).toBe("search");
    expect(resolveActiveAdminNavId("/admin/sign-in")).not.toBe("articles");
  });

  it("treats sign-in as a chrome-less path", () => {
    expect(isAdminSignInPath("/admin/sign-in")).toBe(true);
    expect(isAdminSignInPath("/admin")).toBe(false);
  });
});
