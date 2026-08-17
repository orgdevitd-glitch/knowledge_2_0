import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";

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

describe("architecture: content operations hardening 8E.1", () => {
  it("does not add public picker or admin-search endpoints", () => {
    const publicApi = walk(join(ROOT, "app", "api")).filter(
      (f) => !f.includes(`${join("api", "admin")}`),
    );
    for (const file of publicApi) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/admin\/pickers/);
    }
    expect(
      readdirSync(join(ROOT, "app", "api", "admin", "pickers")),
    ).toEqual(expect.arrayContaining(["media", "materials"]));
  });

  it("keeps SearchDocument schemaVersion 2 and GCS search adapter untouched by pickers", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
    const gcs = readFileSync(
      join(ROOT, "server", "search", "gcs-search-index.ts"),
      "utf8",
    );
    expect(gcs).toMatch(/SEARCH_DOCUMENT_SCHEMA_VERSION/);
    const pickerFiles = walk(join(ROOT, "features", "admin", "pickers"));
    for (const file of pickerFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/schemaVersion/);
      expect(text, file).not.toMatch(/gcs-search-index/);
    }
  });

  it("does not add Gemini or assistant provider code", () => {
    const pickerAndShell = [
      ...walk(join(ROOT, "features", "admin", "pickers")),
      join(ROOT, "features", "admin", "ui", "admin-shell.tsx"),
    ];
    for (const file of pickerAndShell) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/gemini|vertex|openai|anthropic/i);
    }
  });

  it("editor pickers still persist ID-based block fields", () => {
    const form = readFileSync(
      join(
        ROOT,
        "features",
        "admin",
        "articles",
        "components",
        "article-editor",
        "block-form.tsx",
      ),
      "utf8",
    );
    expect(form).toMatch(/MediaPickerField/);
    expect(form).toMatch(/RelatedPickerField/);
    expect(form).toMatch(/mediaId:/);
    expect(form).toMatch(/entityId/);
    expect(form).not.toMatch(/label=\"Media ID\"/);
    expect(form).not.toMatch(/ID сущности/);
  });

  it("picker GET routes stay admin-only via runAdminGet", () => {
    for (const name of ["media", "materials"]) {
      const text = readFileSync(
        join(ROOT, "app", "api", "admin", "pickers", name, "route.ts"),
        "utf8",
      );
      expect(text).toMatch(/runAdminGet/);
      expect(text).toMatch(/pickerMethodNotAllowed/);
      expect(text).not.toMatch(/runAdminMutation/);
      expect(text).not.toMatch(/collection=/);
    }
    expect(readdirSync(join(ROOT, "app", "api", "admin", "pickers")).sort()).toEqual(
      ["materials", "media"],
    );
  });

  it("does not add a generic admin entity picker", () => {
    const apiRoot = join(ROOT, "app", "api", "admin");
    for (const file of walk(apiRoot)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\/api\/admin\/entities/);
      expect(text, file).not.toMatch(/searchParams\.get\(["']collection["']\)/);
    }
  });

  it("keeps public shell free of admin navigation", () => {
    const publicLayout = readFileSync(
      join(ROOT, "app", "(public)", "layout.tsx"),
      "utf8",
    );
    expect(publicLayout).toMatch(/PublicShellChrome/);
    expect(publicLayout).not.toMatch(/AdminShellChrome/);
    expect(publicLayout).not.toMatch(/ADMIN_NAV_ITEMS/);
    const publicShell = readFileSync(
      join(ROOT, "features", "public-content", "ui", "public-shell.tsx"),
      "utf8",
    );
    expect(publicShell).not.toMatch(/\/admin/);
  });

  it("does not introduce a third related-content store", () => {
    const picker = walk(join(ROOT, "features", "admin", "pickers")).concat(
      join(
        ROOT,
        "features",
        "admin",
        "articles",
        "components",
        "article-editor",
        "article-editor.tsx",
      ),
    );
    for (const file of picker) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/relatedMaterialIds/);
      expect(text, file).not.toMatch(/relatedContentIds/);
    }
    const articleEditor = readFileSync(
      join(
        ROOT,
        "features",
        "admin",
        "articles",
        "components",
        "article-editor",
        "article-editor.tsx",
      ),
      "utf8",
    );
    expect(articleEditor).not.toMatch(/relatedArticleIds/);
    expect(articleEditor).not.toMatch(/relatedPromptIds/);
  });

  it("shared ConfirmDialog replaced the article-only copy", () => {
    const articlesDir = join(ROOT, "features", "admin", "articles", "components");
    expect(readdirSync(articlesDir)).not.toContain("confirm-dialog.tsx");
    const taxonomy = readFileSync(
      join(ROOT, "features", "admin", "taxonomy", "components", "archive-dialog.tsx"),
      "utf8",
    );
    expect(taxonomy).toMatch(/ArchiveDialog/);
    const pickers = walk(join(ROOT, "features", "admin", "pickers"));
    for (const file of pickers) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/localStorage|sessionStorage/);
      expect(text, file).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });

  it("leaves Assistant ask and SearchDocument schema unchanged", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
    const ask = readFileSync(
      join(ROOT, "app", "api", "assistant", "ask", "route.ts"),
      "utf8",
    );
    expect(ask).toMatch(/export async function POST/);
    expect(ask).toMatch(/askAssistant/);
    expect(ask).not.toMatch(/gemini/i);
  });
});
