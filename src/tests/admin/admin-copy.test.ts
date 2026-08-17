import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin home and search copy", () => {
  it("does not advertise Phase 5A or a missing editor", () => {
    const home = readFileSync(
      join(process.cwd(), "src/app/admin/page.tsx"),
      "utf8",
    );
    expect(home).not.toMatch(/Phase 5A/i);
    expect(home).not.toMatch(/появятся в Phase 5B/);
    expect(home).not.toMatch(/AUTH_MODE/);
    expect(home).toMatch(/ADMIN_NAV_ITEMS/);
    expect(home).toMatch(/item\.href/);
  });

  it("does not claim search suggestions are missing", () => {
    const search = readFileSync(
      join(process.cwd(), "src/app/admin/search/page.tsx"),
      "utf8",
    );
    expect(search).not.toMatch(/без suggestions/i);
    expect(search).toMatch(/Generation/);
  });
});
