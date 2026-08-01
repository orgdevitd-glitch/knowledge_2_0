import { afterEach, describe, expect, it, vi } from "vitest";

import { SERVICE_NAME } from "@/config/constants";
import { resetServerEnvCacheForTests } from "@/config/env";
import { GET } from "@/app/api/health/route";

afterEach(() => {
  resetServerEnvCacheForTests();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("returns ok payload with no-store caching headers", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");

    const response = GET();
    const body = (await response.json()) as {
      status: string;
      service: string;
      timestamp: string;
      environment: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe(SERVICE_NAME);
    expect(body.environment).toBe("test");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(response.headers.get("Cache-Control")).toMatch(/no-store/i);
  });
});
