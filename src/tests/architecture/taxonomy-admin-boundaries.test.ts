import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

describe("architecture: taxonomy admin Phase 7A", () => {
  it("keeps Firebase Admin and Firestore adapters out of taxonomy UI", () => {
    const root = join(process.cwd(), "src/features/admin/taxonomy/components");
    let files: string[] = [];
    try {
      files = walk(root);
    } catch {
      // components may still be landing; pages are checked below
      files = [];
    }
    const pageRoot = join(process.cwd(), "src/app/admin/taxonomy");
    try {
      files.push(...walk(pageRoot));
    } catch {
      // ignore if pages not yet created
    }
    const forbidden = [
      "firebase-admin",
      "getFirebaseAdminFirestore",
      "googleapis",
      "dangerouslySetInnerHTML",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const token of forbidden) {
        expect(text.includes(token), `${file} contains ${token}`).toBe(false);
      }
    }
  });

  it("mutation routes use runAdminMutation and do not expose delete handlers", () => {
    const root = join(process.cwd(), "src/app/api/admin/taxonomy");
    const files = walk(root);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (file.includes(`${join("usage")}\\`) || file.includes("/usage/")) {
        expect(text.includes("runAdminGet")).toBe(true);
        continue;
      }
      expect(text.includes("runAdminMutation")).toBe(true);
      expect(text.includes("requireAdminPrincipal")).toBe(false);
      expect(/\bexport async function DELETE\b/.test(text)).toBe(false);
      expect(text.includes(".delete(")).toBe(false);
    }
  });

  it("domain taxonomy does not import React or Next", () => {
    const text = readFileSync(
      join(process.cwd(), "src/domain/content/taxonomy.ts"),
      "utf8",
    );
    expect(text.includes("from \"react\"")).toBe(false);
    expect(text.includes("next/")).toBe(false);
  });

  it("auth guard does not depend on Audience", () => {
    const guard = readFileSync(
      join(process.cwd(), "src/server/auth/guard.ts"),
      "utf8",
    );
    expect(guard.toLowerCase().includes("audience")).toBe(false);
  });
});
