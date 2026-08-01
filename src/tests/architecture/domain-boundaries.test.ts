import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("architecture: domain independence", () => {
  it("does not import react, next, firebase, or firestore in domain", () => {
    const domainDir = join(ROOT, "domain");
    const files = walk(domainDir);
    const banned =
      /from\s+["'](react|react-dom|next(?:\/|$)|firebase|@firebase|@google-cloud)/;
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (banned.test(text) || /firestore/i.test(text)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not use production UI imports of memory repositories", () => {
    const uiRoots = [
      join(ROOT, "app"),
      join(ROOT, "components"),
      join(ROOT, "prototypes"),
    ];
    const offenders: string[] = [];
    for (const root of uiRoots) {
      let files: string[] = [];
      try {
        files = walk(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        if (
          text.includes("repositories/memory") ||
          text.includes("MemoryArticleRepository")
        ) {
          offenders.push(relative(process.cwd(), file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
