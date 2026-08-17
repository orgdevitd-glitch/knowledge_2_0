import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAssistantConfig,
  resetAssistantEnvCacheForTests,
} from "@/config/assistant-env";
import { resetServerEnvCacheForTests } from "@/config/env";
import { ASSISTANT_SYSTEM_POLICY_VERSION } from "@/domain/assistant/system-policy";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ASSISTANT_SYSTEM_POLICY } from "@/server/assistant/system-policy";

describe("assistant configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssistantEnvCacheForTests();
    resetServerEnvCacheForTests();
  });

  it("defaults to disabled and allows fake in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ASSISTANT_MODE", "");
    resetAssistantEnvCacheForTests();
    expect(getAssistantConfig().mode).toBe("disabled");

    vi.stubEnv("ASSISTANT_MODE", "fake");
    resetAssistantEnvCacheForTests();
    expect(getAssistantConfig().mode).toBe("fake");
  });

  it("forbids fake in production and rejects unknown mode", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ASSISTANT_MODE", "fake");
    resetServerEnvCacheForTests();
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/fake/);

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ASSISTANT_MODE", "openai");
    resetServerEnvCacheForTests();
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/Unknown ASSISTANT_MODE/);
  });

  it("rejects unsafe limit overrides", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ASSISTANT_MODE", "disabled");
    vi.stubEnv("ASSISTANT_MAX_SOURCES", "9999");
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/ASSISTANT_MAX_SOURCES/);
  });

  it("rejects whitespace mode NaN zero negative Infinity and isolates cache", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ASSISTANT_MODE", "  fake  ");
    resetAssistantEnvCacheForTests();
    // Whitespace is explicitly trimmed/normalized before mode resolve.
    expect(getAssistantConfig().mode).toBe("fake");

    vi.stubEnv("ASSISTANT_MODE", "disabled");
    vi.stubEnv("ASSISTANT_MAX_SOURCES", "NaN");
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/ASSISTANT_MAX_SOURCES/);

    vi.stubEnv("ASSISTANT_MAX_SOURCES", "-1");
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/ASSISTANT_MAX_SOURCES/);

    vi.stubEnv("ASSISTANT_MAX_SOURCES", "0");
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/ASSISTANT_MAX_SOURCES/);

    vi.stubEnv("ASSISTANT_MAX_SOURCES", "Infinity");
    resetAssistantEnvCacheForTests();
    expect(() => getAssistantConfig()).toThrow(/ASSISTANT_MAX_SOURCES/);

    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ASSISTANT_MODE", "fake");
    resetAssistantEnvCacheForTests();
    expect(getAssistantConfig().mode).toBe("fake");
  });

  it("has no NEXT_PUBLIC assistant vars or provider URL/key requirements", () => {
    const envExample = readFileSync(
      join(process.cwd(), ".env.example"),
      "utf8",
    );
    expect(envExample).toMatch(/ASSISTANT_MODE/);
    expect(envExample).not.toMatch(/^[^#]*NEXT_PUBLIC_ASSISTANT/m);
    expect(envExample).not.toMatch(/^\s*ASSISTANT_API_KEY\s*=/m);
    expect(envExample).not.toMatch(/^\s*ASSISTANT_API_URL\s*=/m);
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
    expect(ASSISTANT_SYSTEM_POLICY_VERSION).toBe("assistant-policy-v1");
    expect(ASSISTANT_SYSTEM_POLICY.version).toBe("assistant-policy-v1");
    expect(ASSISTANT_SYSTEM_POLICY.rules.length).toBeGreaterThan(5);
  });
});

describe("assistant architecture boundaries", () => {
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

  it("domain assistant does not import next/firebase/gcs", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "domain", "assistant"))) {
      const text = readFileSync(file, "utf8");
      if (
        /from ["']next\/|from ["']next["']|firebase-admin|@google-cloud\/|from ["']server-only["']/.test(
          text,
        )
      ) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("application assistant does not import provider implementations", () => {
    for (const file of walk(join(ROOT, "features", "assistant"))) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/providers\/fake-provider|providers\/disabled-provider/);
      expect(text).not.toMatch(/GcsSearchIndexAdapter|firebase-admin/);
    }
  });

  it("ask route does not contain retrieval or chunking logic", () => {
    const route = readFileSync(
      join(ROOT, "app", "api", "assistant", "ask", "route.ts"),
      "utf8",
    );
    expect(route).toMatch(/askAssistant/);
    expect(route).not.toMatch(/chunkArticleSnapshot|SearchBackedAssistantRetrieval/);
    expect(route).toMatch(/no-store/);
  });

  it("provider adapters do not import admin write repositories", () => {
    for (const file of walk(join(ROOT, "server", "assistant", "providers"))) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(
        /ArticleRepository|PromptRepository|MediaRepository|Taxonomy/,
      );
      expect(text).not.toMatch(/tool|FunctionCall|ASSISTANT_API_KEY/);
    }
  });

  it("system policy body is server-only and not under prompt admin", () => {
    const policy = readFileSync(
      join(ROOT, "server", "assistant", "system-policy.ts"),
      "utf8",
    );
    expect(policy).toMatch(/server-only/);
    expect(policy).toMatch(/ASSISTANT_SYSTEM_POLICY/);
    expect(policy).toMatch(/Not Prompt Library material/);
    expect(policy).not.toMatch(/features\/admin\/prompts|prompt-use-cases/);

    const versionOnly = readFileSync(
      join(ROOT, "domain", "assistant", "system-policy.ts"),
      "utf8",
    );
    expect(versionOnly).toMatch(/ASSISTANT_SYSTEM_POLICY_VERSION/);
    expect(versionOnly).not.toMatch(/rules:/);
  });
});
