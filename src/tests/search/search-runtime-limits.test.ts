import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSearchLimits,
  resetSearchEnvCacheForTests,
} from "@/config/search-env";
import { resetServerEnvCacheForTests } from "@/config/env";
import { getPublicSearchUiLimits } from "@/server/composition/search-ui-limits";
import { executePublicSearch } from "@/features/search/application/search-query-service";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";

describe("runtime SEARCH_QUERY_MAX_LENGTH", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
  });

  it("resolves the same max length for UI props and server validation", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "memory");
    vi.stubEnv("SEARCH_QUERY_MAX_LENGTH", "64");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();

    const ui = getPublicSearchUiLimits();
    const limits = getSearchLimits();
    expect(ui.queryMaxLength).toBe(64);
    expect(limits.queryMaxLength).toBe(64);
    expect(ui.queryMaxLength).toBe(limits.queryMaxLength);
  });

  it("server validation uses the resolved runtime limit", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "memory");
    vi.stubEnv("SEARCH_QUERY_MAX_LENGTH", "40");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();

    const q = "x".repeat(41);
    const result = await executePublicSearch({ q });
    expect(result.tooLong).toBe(true);
    expect(getSearchLimits().queryMaxLength).toBe(40);
  });

  it("invalid SEARCH_QUERY_MAX_LENGTH remains fail-closed", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "memory");
    vi.stubEnv("SEARCH_QUERY_MAX_LENGTH", "not-a-number");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(() => getSearchLimits()).toThrow(/Invalid SEARCH_QUERY_MAX_LENGTH/i);
  });

  it("out-of-bounds SEARCH_QUERY_MAX_LENGTH remains fail-closed", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "memory");
    vi.stubEnv("SEARCH_QUERY_MAX_LENGTH", "1");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(() => getSearchLimits()).toThrow(/Invalid SEARCH_QUERY_MAX_LENGTH/i);
  });

  it("defaults match SEARCH_LIMIT_DEFAULTS when env unset", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEARCH_INDEX_MODE", "memory");
    vi.stubEnv("SEARCH_QUERY_MAX_LENGTH", "");
    resetSearchEnvCacheForTests();
    resetServerEnvCacheForTests();
    expect(getPublicSearchUiLimits().queryMaxLength).toBe(
      SEARCH_LIMIT_DEFAULTS.queryMaxLength,
    );
  });
});
