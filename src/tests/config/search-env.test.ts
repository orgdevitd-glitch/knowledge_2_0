import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSearchLimits,
  resetSearchEnvCacheForTests,
  resolveSearchIndexMode,
} from "@/config/search-env";
import { resetServerEnvCacheForTests } from "@/config/env";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";

describe("search env fail-closed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
  });

  it("requires gcs in production", () => {
    expect(() =>
      resolveSearchIndexMode({
        nodeEnv: "production",
        rawMode: undefined,
      }),
    ).toThrow(/required in production/i);
  });

  it("forbids memory in production", () => {
    expect(() =>
      resolveSearchIndexMode({
        nodeEnv: "production",
        rawMode: "memory",
      }),
    ).toThrow(/forbidden in production/i);
  });

  it("rejects unknown modes", () => {
    expect(() =>
      resolveSearchIndexMode({
        nodeEnv: "development",
        rawMode: "elastic",
      }),
    ).toThrow(/Unknown SEARCH_INDEX_MODE/i);
  });

  it("requires SEARCH_INDEX_BUCKET for gcs without silent media fallback", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "gcs");
    vi.stubEnv("SEARCH_INDEX_BUCKET", "");
    vi.stubEnv("MEDIA_GCS_BUCKET", "media-bucket");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(() => getSearchLimits()).toThrow(/SEARCH_INDEX_BUCKET is required/i);
  });

  it("requires SEARCH_CURSOR_HMAC_SECRET in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEARCH_INDEX_MODE", "gcs");
    vi.stubEnv("SEARCH_INDEX_BUCKET", "search-bucket");
    vi.stubEnv("SEARCH_CURSOR_HMAC_SECRET", "");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(() => getSearchLimits()).toThrow(/SEARCH_CURSOR_HMAC_SECRET/i);
  });

  it("rejects too-short production cursor secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEARCH_INDEX_MODE", "gcs");
    vi.stubEnv("SEARCH_INDEX_BUCKET", "search-bucket");
    vi.stubEnv("SEARCH_CURSOR_HMAC_SECRET", "short");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(() => getSearchLimits()).toThrow(
      new RegExp(String(SEARCH_LIMIT_DEFAULTS.cursorHmacSecretMinLength)),
    );
  });

  it("rejects path-unsafe SEARCH_INDEX_PREFIX", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "memory");
    vi.stubEnv("SEARCH_INDEX_PREFIX", "../evil");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(() => getSearchLimits()).toThrow(/Invalid SEARCH_INDEX_PREFIX/i);
  });
});
