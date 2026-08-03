import { beforeEach, describe, expect, it } from "vitest";

import { resetSearchEnvCacheForTests } from "@/config/search-env";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { publicSearchSuggestionsLimiter } from "@/server/auth/rate-limit";
import { resetSearchCompositionForTests } from "@/server/composition/search-ports";
import { GET } from "@/app/api/search/suggestions/route";

describe("GET /api/search/suggestions", () => {
  beforeEach(() => {
    process.env.SEARCH_INDEX_MODE = "memory";
    process.env.PERSISTENCE_MODE = "memory";
    resetSearchEnvCacheForTests();
    resetSearchCompositionForTests();
    // Drain limiter buckets between tests by creating fresh keys via unique IPs
  });

  it("is dynamic and returns no-store", async () => {
    const mod = await import("@/app/api/search/suggestions/route");
    expect(mod.dynamic).toBe("force-dynamic");
    const res = await GET(
      new Request("http://localhost/api/search/suggestions?q=an", {
        headers: { "x-forwarded-for": `suggest-ok-${Date.now()}` },
      }),
    );
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("status");
    expect(JSON.stringify(body)).not.toMatch(/gs:\/\/|stack|provider/i);
  });

  it("validates oversized q", async () => {
    const q = "x".repeat(SEARCH_LIMIT_DEFAULTS.queryMaxLength + 1);
    const res = await GET(
      new Request(`http://localhost/api/search/suggestions?q=${q}`, {
        headers: { "x-forwarded-for": `suggest-val-${Date.now()}` },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rate limits separately", async () => {
    const ip = `suggest-rl-${Date.now()}`;
    let limited = false;
    for (let i = 0; i < 150; i += 1) {
      const res = await GET(
        new Request("http://localhost/api/search/suggestions?q=an", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      if (res.status === 429) {
        limited = true;
        expect(res.headers.get("Retry-After")).toBeTruthy();
        break;
      }
    }
    expect(limited).toBe(true);
    expect(publicSearchSuggestionsLimiter).toBeTruthy();
  });
});
