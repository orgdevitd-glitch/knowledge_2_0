import { afterEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvCacheForTests } from "@/config/env";
import { logger } from "@/lib/logger";

afterEach(() => {
  resetServerEnvCacheForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("redacts sensitive context keys", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("boom", {
      apiKey: "super-secret",
      route: "/api/health",
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as {
      context: { apiKey: string; route: string };
    };

    expect(parsed.context.apiKey).toBe("[redacted]");
    expect(parsed.context.route).toBe("/api/health");
    expect(line).not.toContain("super-secret");
  });
});
