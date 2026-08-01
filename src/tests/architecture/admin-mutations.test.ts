import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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

describe("architecture: admin mutations Phase 5B", () => {
  it("admin API routes use CSRF helper and admin auth", () => {
    const apiRoot = join(ROOT, "app", "api", "admin");
    const files = walk(apiRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const isGetOnly =
        /\brunAdminGet\b/.test(text) && !/\bPOST\b|\bPATCH\b|\bPUT\b|\bDELETE\b/.test(text);
      // Memory-mode binary upload proxy: admin auth + Origin + rate limit (not JSON CSRF body).
      const isMediaUploadProxy = file.includes(
        `${join("media", "upload-proxy")}`,
      );
      if (isGetOnly) {
        expect(text).toMatch(/runAdminGet/);
      } else if (isMediaUploadProxy) {
        expect(text).toMatch(/requireAdminPrincipalForApi/);
        expect(text).toMatch(/isAllowedOrigin/);
      } else {
        expect(text).toMatch(/runAdminMutation|runAdminGet/);
      }
    }
  });

  it("client admin features do not import firebase-admin or Firestore adapters", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "features", "admin"))) {
      const text = readFileSync(file, "utf8");
      if (!text.includes('"use client"') && !text.includes("'use client'")) {
        continue;
      }
      if (
        /firebase-admin/.test(text) ||
        /firestore-article-repository/.test(text) ||
        /from ["']@\/server\/firebase/.test(text)
      ) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("forbids dangerouslySetInnerHTML in admin editor", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "features", "admin"))) {
      const text = readFileSync(file, "utf8");
      if (/dangerouslySetInnerHTML/.test(text)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
