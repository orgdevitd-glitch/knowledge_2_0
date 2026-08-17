import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";

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

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("assistant experience page and integration contracts", () => {
  it("disabled page contract is encoded in the route", () => {
    const page = read(join("app", "(public)", "assistant", "page.tsx"));
    expect(page).toMatch(/getPublicAssistantCapability/);
    expect(page).toMatch(/AssistantUnavailable/);
    expect(page).toMatch(/AssistantExperience/);
    expect(page).toMatch(/index: false/);
    expect(page).toMatch(/follow: false/);
    expect(page).not.toMatch(/askAssistant/);
    expect(page).not.toMatch(/system-policy/);
    expect(page).not.toMatch(/fake-provider|disabled-provider/);
    expect(page).not.toMatch(/fetch\(["'`]\/api\/assistant\/ask/);
    expect(page).not.toMatch(/searchParams/);
    expect(page).not.toMatch(/process\.env\.ASSISTANT_MODE/);
    expect(page).not.toMatch(/process\.env\.NODE_ENV/);
    expect(page).toMatch(/await import\(/);
    expect(page).not.toMatch(
      /import \{ AssistantExperience \} from "@\/features\/assistant\/ui\/assistant-experience"/,
    );
  });

  it("homepage and search gate the entry link on capability", () => {
    const home = read(join("app", "(public)", "page.tsx"));
    expect(home).toMatch(/getPublicAssistantCapability/);
    expect(home).toMatch(/assistant\.available/);
    expect(home).toMatch(/AssistantEntryLink/);
    expect(home).not.toMatch(/Спросить ИИ|умный AI|гарантированный ответ/i);
    expect(home).not.toMatch(/process\.env\.ASSISTANT_MODE|ASSISTANT_MODE/);
    expect(home).not.toMatch(/href=\{`\/assistant\?/);

    const search = read(join("app", "(public)", "search", "page.tsx"));
    expect(search).toMatch(/getPublicAssistantCapability/);
    expect(search).toMatch(/assistant\.available/);
    expect(search).toMatch(/AssistantEntryLink/);
    expect(search).not.toMatch(/askAssistantClient/);
    expect(search).not.toMatch(/process\.env\.ASSISTANT_MODE|ASSISTANT_MODE/);
    expect(search).not.toMatch(/buildSearchHref\([^)]*assistant/);
  });

  it("layout passes capability into navigation chrome", () => {
    const layout = read(join("app", "(public)", "layout.tsx"));
    expect(layout).toMatch(/assistantAvailable=\{assistant\.available\}/);
    expect(layout).not.toMatch(/process\.env\.ASSISTANT_MODE|ASSISTANT_MODE/);
    const shell = read(join("features", "public-content", "ui", "public-shell.tsx"));
    expect(shell).toMatch(/buildPublicNavItems/);
    expect(shell).not.toMatch(/PUBLIC_NAV_ITEMS\.map/);
    expect(shell).not.toMatch(/process\.env\.ASSISTANT_MODE|ASSISTANT_MODE|NODE_ENV/);
    expect(shell).not.toMatch(/window\.|localStorage/);
  });

  it("sitemap includes /assistant only via capability helper", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toMatch(/getPublicAssistantCapability/);
    expect(sitemap).toMatch(/\/assistant/);
    expect(sitemap).not.toMatch(/ASSISTANT_MODE|provider|model/);
  });

  it("keeps SearchDocument schema 2 and ask route contract", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
    const route = read(join("app", "api", "assistant", "ask", "route.ts"));
    expect(route).toMatch(/bodySchema/);
    expect(route).toMatch(/type: z\.enum\(\["article", "prompt", "all"\]\)/);
    expect(route).toMatch(/FORBIDDEN_CLIENT_FIELDS/);
    expect(route).toMatch(/askAssistant/);
    const statusRoute = join(ROOT, "app", "api", "assistant", "status");
    expect(() => readdirSync(statusRoute)).toThrow();
  });
});

describe("assistant experience architecture boundaries", () => {
  it("client modules do not import policy ask-assistant providers or env parser", () => {
    const roots = [
      join(ROOT, "features", "assistant", "ui"),
      join(ROOT, "features", "assistant", "client"),
    ];
    const offenders: string[] = [];
    const banned =
      /system-policy|ask-assistant|fake-provider|disabled-provider|assistant-env|assistant-ports|SearchBackedAssistantRetrieval|from ["']@\/server\/assistant|from ["']@\/domain\/assistant\/limits|from ["']@\/domain\/assistant\/system-policy/;
    for (const root of roots) {
      for (const file of walk(root)) {
        const text = readFileSync(file, "utf8");
        if (banned.test(text) || text.includes("dangerouslySetInnerHTML")) {
          offenders.push(file);
        }
        if (/"use client"/.test(text) && /from ["']@\/server\//.test(text)) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("experience UI is not a chat or persistence surface", () => {
    const ui = walk(join(ROOT, "features", "assistant", "ui"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(ui).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(ui).not.toMatch(/chat bubble|avatar|conversation|messages:/i);
    expect(ui).not.toMatch(/react-markdown|marked|dangerouslySetInnerHTML/);
    expect(ui).not.toMatch(/setTimeout|setInterval|addEventListener/);
    expect(ui).not.toMatch(/router\.(push|replace)|useRouter/);
    expect(ui).not.toMatch(/console\.(log|info|debug|error|warn)/);
  });

  it("assistant CSS encodes overflow wrap and 44px chip/action targets", () => {
    const css = readFileSync(
      join(ROOT, "features", "assistant", "ui", "assistant.module.css"),
      "utf8",
    );
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).toMatch(/flex-wrap:\s*wrap/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/\.chip[\s\S]*min-height:\s*2\.75rem/);
    expect(css).toMatch(/\.filtersToggle[\s\S]*min-height:\s*2\.75rem/);
    expect(css).toMatch(/\.actions :global\(button\)[\s\S]*min-height:\s*2\.75rem/);
  });
});
