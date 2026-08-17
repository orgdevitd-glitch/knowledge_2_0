import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ASSISTANT_ENV_BOUNDS } from "@/domain/assistant/limits";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import { ASSISTANT_CLIENT_DTO_BOUNDS } from "@/features/assistant/client/public-dto";
import sitemap from "@/app/sitemap";
import { resetAssistantEnvCacheForTests } from "@/config/assistant-env";
import { resetServerEnvCacheForTests } from "@/config/env";
import { getPublicAssistantCapability } from "@/server/composition/assistant-ui-capability";
import { resetAssistantTestEnv } from "./helpers";

const ROOT = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("assistant experience hardening contracts", () => {
  afterEach(() => {
    resetAssistantTestEnv("fake");
  });

  it("keeps client display bounds at least as wide as server maxima", () => {
    expect(ASSISTANT_CLIENT_DTO_BOUNDS.maxBlocks).toBeGreaterThanOrEqual(
      ASSISTANT_ENV_BOUNDS.maxAnswerBlocksMax,
    );
    expect(ASSISTANT_CLIENT_DTO_BOUNDS.maxBlockCharacters).toBeGreaterThanOrEqual(
      ASSISTANT_ENV_BOUNDS.maxAnswerCharactersMax,
    );
    expect(ASSISTANT_CLIENT_DTO_BOUNDS.maxCitations).toBeGreaterThanOrEqual(
      ASSISTANT_ENV_BOUNDS.maxCitationsMax,
    );
  });

  it("public UI surfaces do not read ASSISTANT_MODE or NODE_ENV directly", () => {
    const files = [
      join(ROOT, "app", "(public)", "assistant", "page.tsx"),
      join(ROOT, "app", "(public)", "page.tsx"),
      join(ROOT, "app", "(public)", "search", "page.tsx"),
      join(ROOT, "app", "(public)", "layout.tsx"),
      join(ROOT, "app", "sitemap.ts"),
      join(ROOT, "features", "public-content", "nav.ts"),
      join(ROOT, "features", "public-content", "ui", "public-shell.tsx"),
      ...walk(join(ROOT, "features", "assistant", "ui")),
      ...walk(join(ROOT, "features", "assistant", "client")),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/process\.env\.ASSISTANT_MODE/);
      expect(text, file).not.toMatch(/process\.env\.NODE_ENV/);
      expect(text, file).not.toMatch(/getAssistantConfig\(/);
    }
  });

  it("omits /assistant from sitemap when unavailable or misconfigured", async () => {
    resetAssistantTestEnv("disabled");
    process.env.SITE_URL = "https://portal.example";
    process.env.CONTENT_SOURCE_MODE = "empty";
    resetServerEnvCacheForTests();
    resetAssistantEnvCacheForTests();
    const disabled = await sitemap();
    expect(disabled.map((e) => e.url)).not.toContain("https://portal.example/assistant");
    expect(JSON.stringify(disabled)).not.toMatch(/ASSISTANT_MODE|fake-provider|policy/i);

    process.env.ASSISTANT_MAX_SOURCES = "9999";
    process.env.ASSISTANT_MODE = "fake";
    resetServerEnvCacheForTests();
    resetAssistantEnvCacheForTests();
    expect(getPublicAssistantCapability().available).toBe(false);
    const broken = await sitemap();
    expect(broken.map((e) => e.url)).not.toContain("https://portal.example/assistant");
    delete process.env.ASSISTANT_MAX_SOURCES;
    delete process.env.SITE_URL;
    delete process.env.CONTENT_SOURCE_MODE;
  });

  it("keeps SearchDocument schema 2 and GCS generation schemaVersion import", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
    const gcs = readFileSync(
      join(ROOT, "server", "search", "gcs-search-index.ts"),
      "utf8",
    );
    expect(gcs).toMatch(/schemaVersion:\s*SEARCH_DOCUMENT_SCHEMA_VERSION/);
  });

  it("does not add assistant persistence collections or status route", () => {
    const firestoreModel = readFileSync(
      join(process.cwd(), "docs", "infrastructure", "FIRESTORE-MODEL.md"),
      "utf8",
    );
    expect(firestoreModel).not.toMatch(/assistantMessages|assistantSessions|assistant_history/);
    expect(() =>
      readdirSync(join(ROOT, "app", "api", "assistant", "status")),
    ).toThrow();
    const client = walk(join(ROOT, "features", "assistant", "client"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(client).not.toMatch(/\/api\/assistant\/status/);
  });
});

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("assistant client production chunks", () => {
  const staticDir = join(process.cwd(), ".next", "static");
  const hasBuild = existsSync(staticDir);

  it.skipIf(!hasBuild)("does not embed server-only assistant policy or mode", () => {
    const files = walkFiles(staticDir).filter((f) => /\.(js|map)$/.test(f));
    const hits: string[] = [];
    const banned = [
      "ASSISTANT_MODE",
      "assistant-policy-v1",
      "You answer only from the provided evidence items.",
      "FakeAssistantProviderAdapter",
      "DisabledAssistantProviderAdapter",
      "ASSISTANT_PROVIDER_TIMEOUT_MS",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const needle of banned) {
        if (text.includes(needle)) {
          hits.push(`${file}: ${needle}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
