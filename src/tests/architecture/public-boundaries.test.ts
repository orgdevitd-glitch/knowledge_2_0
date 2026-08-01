import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else if (/\.(ts|tsx)$/.test(name)) out.push(full);
    }
  } catch {
    return out;
  }
  return out;
}

describe("architecture: public boundaries", () => {
  it("public UI does not import demo dataset or memory repos directly", () => {
    const roots = [
      join(ROOT, "app", "(public)"),
      join(ROOT, "components"),
      join(ROOT, "features", "public-content", "ui"),
    ];
    const offenders: string[] = [];
    const banned =
      /demo-dataset|load-demo-catalog|repositories\/memory|MemoryArticleRepository/;
    for (const root of roots) {
      for (const file of walk(root)) {
        const text = readFileSync(file, "utf8");
        if (banned.test(text)) {
          offenders.push(relative(process.cwd(), file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("client components do not import server-only modules", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "features", "public-content"))) {
      const text = readFileSync(file, "utf8");
      if (!text.includes('"use client"') && !text.includes("'use client'")) {
        continue;
      }
      if (
        /from ["']@\/config\/env["']/.test(text) ||
        /from ["']@\/server\//.test(text) ||
        /from ["']@\/features\/public-content\/queries["']/.test(text) ||
        /import ["']server-only["']/.test(text)
      ) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("public renderers do not use dangerouslySetInnerHTML", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "features", "public-content"))) {
      const text = readFileSync(file, "utf8");
      if (text.includes("dangerouslySetInnerHTML")) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
