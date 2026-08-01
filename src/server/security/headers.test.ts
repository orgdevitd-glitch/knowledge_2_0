import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSecurityHeaders } from "@/server/security/headers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildSecurityHeaders", () => {
  it("includes CSP and framing protections in development without HSTS", () => {
    const headers = buildSecurityHeaders({
      isDevelopment: true,
      isProduction: false,
    });
    const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));

    expect(map["Content-Security-Policy"]).toMatch(/unsafe-eval/);
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Strict-Transport-Security"]).toBeUndefined();
  });

  it("adds HSTS in production and drops unsafe-eval", () => {
    const headers = buildSecurityHeaders({
      isDevelopment: false,
      isProduction: true,
    });
    const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));

    expect(map["Content-Security-Policy"]).not.toMatch(/unsafe-eval/);
    expect(map["Strict-Transport-Security"]).toMatch(/max-age=/);
  });
});
