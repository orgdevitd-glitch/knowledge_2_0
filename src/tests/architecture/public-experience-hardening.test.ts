import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("architecture: public experience hardening 8E.2", () => {
  it("preview and public share ArticlePublicView / PromptPublicView", () => {
    const publicArticle = read(join("app", "(public)", "articles", "[slug]", "page.tsx"));
    const previewArticle = read(
      join("app", "admin", "articles", "[articleId]", "preview", "page.tsx"),
    );
    const publicPrompt = read(join("app", "(public)", "prompts", "[slug]", "page.tsx"));
    const previewPrompt = read(
      join("app", "admin", "prompts", "[promptId]", "preview", "page.tsx"),
    );

    expect(publicArticle).toMatch(/ArticlePublicView/);
    expect(previewArticle).toMatch(/ArticlePublicView/);
    expect(previewArticle).toMatch(/buildArticleDetail/);
    expect(previewArticle).toMatch(/Предпросмотр черновика/);
    expect(previewArticle).toMatch(/requireAdminPrincipal/);
    expect(previewArticle).toMatch(/index:\s*false/);
    expect(previewArticle).not.toMatch(/toc:\s*\[\]/);
    expect(previewArticle).not.toMatch(/relatedMaterials:\s*\[\]/);
    expect(previewArticle).not.toMatch(/storage\.googleapis\.com/);

    expect(publicPrompt).toMatch(/PromptPublicView/);
    expect(previewPrompt).toMatch(/PromptPublicView/);
    expect(previewPrompt).toMatch(/buildPromptDetail/);
    expect(previewPrompt).toMatch(/Предпросмотр черновика/);
    expect(previewPrompt).toMatch(/requireAdminPrincipal/);
    expect(previewPrompt).toMatch(/index:\s*false/);
    expect(previewPrompt).not.toMatch(/Phase 5/);

    const queries = read(join("features", "public-content", "queries.ts"));
    expect(queries).toMatch(/buildArticleDetail/);
    expect(queries).toMatch(/buildPromptDetail/);
    expect(queries).toMatch(/isPubliclyVisible/);
  });

  it("does not introduce a second article renderer", () => {
    const view = read(join("features", "public-content", "ui", "article-public-view.tsx"));
    expect(view).toMatch(/ArticleBlocks/);
    expect(view).toMatch(/ArticleTableOfContents/);
    const preview = read(
      join("app", "admin", "articles", "[articleId]", "preview", "page.tsx"),
    );
    expect(preview).not.toMatch(/from ["']@\/features\/public-content\/rendering\/block-registry["']/);
  });

  it("keeps SearchDocument schemaVersion 2 and Assistant ask unchanged", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
    const ask = read(join("app", "api", "assistant", "ask", "route.ts"));
    expect(ask).toMatch(/export async function POST/);
    expect(ask).toMatch(/askAssistant/);
    expect(ask).not.toMatch(/gemini/i);
  });

  it("does not add dangerouslySetInnerHTML or browser storage for discovery UI", () => {
    const files = [
      ...walk(join(ROOT, "features", "public-content", "ui")),
      join(ROOT, "features", "public-content", "catalog-url.ts"),
      join(ROOT, "features", "public-content", "build-detail.ts"),
      join(ROOT, "app", "admin", "articles", "[articleId]", "preview", "page.tsx"),
      join(ROOT, "app", "admin", "prompts", "[promptId]", "preview", "page.tsx"),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/dangerouslySetInnerHTML/);
      expect(text, file).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it("does not add Gemini, Video admin, or new env vars", () => {
    const files = [
      join(ROOT, "features", "public-content", "nav.ts"),
      join(ROOT, "features", "public-content", "build-detail.ts"),
      join(ROOT, "features", "public-content", "catalog-url.ts"),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/gemini|vertex|openai|anthropic/i);
      expect(text, file).not.toMatch(/process\.env/);
    }
  });

  it("keeps catalog slug filters separate from Search taxonomy IDs", () => {
    const catalogUrl = read(join("features", "public-content", "catalog-url.ts"));
    const searchUrl = read(join("features", "search", "url", "search-url-state.ts"));
    expect(catalogUrl).toMatch(/from ["']@\/domain\/shared\/value-objects["']/);
    expect(catalogUrl).toMatch(/parseSlug/);
    expect(searchUrl).toMatch(/Taxonomy values are IDs/);
    expect(catalogUrl).not.toMatch(/buildSearchHref/);
    expect(searchUrl).not.toMatch(/parseCatalogSlug/);
  });

  it("uses an explicit now clock for review status", () => {
    const review = read(join("features", "public-content", "review-status.ts"));
    expect(review).toMatch(/function resolveReviewStatus/);
    expect(review).not.toMatch(/Date\.now\(/);
  });

  it("hides the unused TOC copy with display none, not opacity", () => {
    const css = readFileSync(
      join(ROOT, "features", "public-content", "ui", "article-toc.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.desktop\s*\{[\s\S]*?display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 1100px\)[\s\S]*\.mobile\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 1100px\)[\s\S]*\.desktop\s*\{[^}]*display:\s*block/);
    expect(css).not.toMatch(/opacity:\s*0/);
    expect(css).not.toMatch(/visibility:\s*hidden/);
    const toc = read(join("features", "public-content", "ui", "article-toc.tsx"));
    expect(toc).toMatch(/function TocList/);
    expect(toc.match(/<TocList items=\{items\} \/>/g)?.length).toBe(2);
    expect(toc).not.toMatch(/matchMedia|scrollIntoView|window\.scroll/);
  });

  it("keeps presentational views out of the app main landmark", () => {
    const articleView = read(join("features", "public-content", "ui", "article-public-view.tsx"));
    const promptView = read(join("features", "public-content", "ui", "prompt-public-view.tsx"));
    const publicLayout = read(join("app", "(public)", "layout.tsx"));
    const adminShell = read(join("features", "admin", "ui", "admin-shell.tsx"));
    expect(articleView).not.toMatch(/<main\b/);
    expect(promptView).not.toMatch(/<main\b/);
    expect(publicLayout).toMatch(/<main id="main-content">/);
    expect(adminShell).toMatch(/<main id="admin-main">/);
  });

  it("does not widen anonymous media delivery in preview", () => {
    const mediaRoute = read(join("app", "media", "[mediaId]", "route.ts"));
    const preview = read(
      join("app", "admin", "articles", "[articleId]", "preview", "page.tsx"),
    );
    const resolver = read(join("features", "public-content", "rendering", "media-resolver.ts"));
    expect(mediaRoute).toMatch(/isPubliclyDeliverable/);
    expect(preview).toMatch(/getPublicMediaPresentationResolver/);
    expect(resolver).toMatch(/url: `\/media\/\$\{mediaId\}`/);
    expect(resolver).not.toMatch(/storage\.googleapis\.com/);
    expect(preview).toMatch(/follow:\s*false/);
  });

  it("keeps public unpublished materials behind published queries", () => {
    const publicArticle = read(join("app", "(public)", "articles", "[slug]", "page.tsx"));
    const publicPrompt = read(join("app", "(public)", "prompts", "[slug]", "page.tsx"));
    expect(publicArticle).toMatch(/getPublishedArticleBySlug/);
    expect(publicArticle).toMatch(/notFound\(\)/);
    expect(publicPrompt).toMatch(/getPublishedPromptBySlug/);
    expect(publicPrompt).toMatch(/notFound\(\)/);
  });
});
