import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(full);
  }
  return files;
}

describe("architecture: Google Workspace Phase 6A", () => {
  it("keeps googleapis and adapters out of client/features UI and domain", () => {
    const roots = [
      join(process.cwd(), "src/components"),
      join(process.cwd(), "src/domain"),
      join(process.cwd(), "src/features/admin"),
      join(process.cwd(), "src/features/public-content"),
      join(process.cwd(), "src/app/(public)"),
    ];
    const forbidden = [
      "googleapis",
      "google-auth-library",
      "from \"@/server/google-workspace/",
      "documents.batchUpdate",
      "spreadsheets.values.update",
      "spreadsheets.values.batchUpdate",
      "spreadsheets.values.append",
      "changes.watch",
      "changes.list",
      "Cloud Scheduler",
      "domain-wide delegation",
    ];

    for (const root of roots) {
      let files: string[] = [];
      try {
        files = walk(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const token of forbidden) {
          expect(text.includes(token), `${file} contains ${token}`).toBe(false);
        }
      }
    }
  });

  it("does not include Drive write or Docs write in google-workspace server adapters", () => {
    const root = join(process.cwd(), "src/server/google-workspace");
    const files = walk(root);
    for (const file of files) {
      if (file.includes(`${join("testing")}`)) continue;
      const text = readFileSync(file, "utf8");
      expect(text.includes("documents.batchUpdate")).toBe(false);
      expect(text.includes("files.create")).toBe(false);
      expect(text.includes("files.update")).toBe(false);
      expect(text.includes("spreadsheets.values.update")).toBe(false);
      expect(text.includes("spreadsheets.values.append")).toBe(false);
      expect(text.includes("changes.watch")).toBe(false);
      expect(text.includes("changes.list")).toBe(false);
    }
  });

  it("keeps a single canonical Google Workspace pipeline", () => {
    const cwd = process.cwd();
    const expected = [
      "src/server/google-workspace/url-parser.ts",
      "src/server/google-workspace/drive/boundary-policy.ts",
      "src/features/integrations/google/docs/map-google-doc-to-draft.ts",
      "src/features/integrations/google/sheets/parse-prompt-sheet.ts",
      "src/features/integrations/google/application/create-import-preview.ts",
      "src/features/integrations/google/application/confirm-import.ts",
    ];
    for (const rel of expected) {
      expect(statSync(join(cwd, rel)).isFile()).toBe(true);
    }

    const forbiddenDuplicates = [
      "src/features/integrations/google/docs/docs-to-article-mapper.ts",
      "src/features/integrations/google/sheets/sheets-to-prompts-mapper.ts",
      "src/features/integrations/google/application/confirm-docs-import.ts",
      "src/features/integrations/google/application/create-docs-preview.ts",
      "src/features/integrations/google/application/create-source.ts",
      "src/domain/integrations/import-draft.ts",
    ];
    for (const rel of forbiddenDuplicates) {
      try {
        statSync(join(cwd, rel));
        expect.fail(`duplicate pipeline file should not exist: ${rel}`);
      } catch (error) {
        expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
      }
    }
  });

  it("import UI client modules do not import googleapis", () => {
    const root = join(process.cwd(), "src/features/integrations/google");
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8");
      if (!text.includes('"use client"') && !text.includes("'use client'")) {
        continue;
      }
      expect(text.includes("googleapis")).toBe(false);
      expect(text.includes("@/server/google-workspace/")).toBe(false);
    }
  });
});
