import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "tests") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("architecture: search foundation Phase 8B.1", () => {
  it("public search API does not expose storage paths or scores", () => {
    const route = readFileSync(
      join(ROOT, "app", "api", "search", "route.ts"),
      "utf8",
    );
    expect(route).toMatch(/executePublicSearch/);
    expect(route).toMatch(/publicSearchLimiter/);
    expect(route).toMatch(/force-dynamic/);
    expect(route).toMatch(/no-store/);
    expect(route).not.toMatch(/searchableText/);
    expect(route).not.toMatch(/gs:\/\//);
  });

  it("domain search does not import next or firebase-admin", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "domain", "search"))) {
      const text = readFileSync(file, "utf8");
      if (/from ["']next|firebase-admin|server-only/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("admin search mutations use runAdminMutation", () => {
    for (const name of ["rebuild", "reindex"]) {
      const text = readFileSync(
        join(ROOT, "app", "api", "admin", "search", name, "route.ts"),
        "utf8",
      );
      expect(text).toMatch(/runAdminMutation/);
    }
  });

  it("article/prompt lifecycle routes use orchestration not direct indexing-service", () => {
    const routes = [
      join("articles", "[articleId]", "publish", "route.ts"),
      join("articles", "[articleId]", "hide", "route.ts"),
      join("articles", "[articleId]", "archive", "route.ts"),
      join("prompts", "[promptId]", "publish", "route.ts"),
      join("prompts", "[promptId]", "hide", "route.ts"),
      join("prompts", "[promptId]", "archive", "route.ts"),
    ];
    for (const rel of routes) {
      const text = readFileSync(
        join(ROOT, "app", "api", "admin", rel),
        "utf8",
      );
      expect(text).toMatch(/content-search-orchestration/);
      expect(text).not.toMatch(/indexing-service/);
      expect(text).not.toMatch(/indexAfterArticle/);
      expect(text).not.toMatch(/indexAfterPrompt/);
    }
  });
});
