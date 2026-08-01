import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCsrfToken,
  verifyCsrfToken,
} from "@/server/auth/csrf";
import {
  createAdminSessionFromIdToken,
  isAllowedOrigin,
  RECENT_AUTH_MAX_AGE_SECONDS,
  SessionError,
  verifyAdminSessionCookie,
  type FirebaseAuthPort,
} from "@/server/auth/session";
import type { AdminAccessPolicy } from "@/server/auth/access-policy";
import {
  getAuthMode,
  getContentSourceMode,
  resetServerEnvCacheForTests,
} from "@/config/env";
import { resetPublicEnvCacheForTests } from "@/config/public-env";

afterEach(() => {
  resetServerEnvCacheForTests();
  resetPublicEnvCacheForTests();
  vi.unstubAllEnvs();
});

describe("CSRF", () => {
  it("accepts matching valid token", () => {
    const payload = createCsrfToken(1_000_000);
    expect(verifyCsrfToken(payload.token, payload.token, 1_000_000)).toBe(true);
  });

  it("rejects missing mismatched expired tokens", () => {
    const payload = createCsrfToken(1_000_000);
    expect(verifyCsrfToken(undefined, payload.token, 1_000_000)).toBe(false);
    expect(verifyCsrfToken(payload.token, "other", 1_000_000)).toBe(false);
    expect(
      verifyCsrfToken(payload.token, payload.token, 1_000_000 + 3 * 60 * 60 * 1000),
    ).toBe(false);
  });
});

describe("session creation with fake auth port", () => {
  const allowAll: AdminAccessPolicy = {
    isAllowed: ({ email, emailVerified }) =>
      Boolean(emailVerified && email === "admin@example.com"),
  };

  function fakePort(overrides?: Partial<{
    email: string;
    emailVerified: boolean;
    auth_time: number;
  }>): FirebaseAuthPort {
    const now = Math.floor(Date.now() / 1000);
    return {
      async verifyIdToken() {
        return {
          uid: "u1",
          email: overrides?.email ?? "admin@example.com",
          email_verified: overrides?.emailVerified ?? true,
          auth_time: overrides?.auth_time ?? now,
          iat: now,
        } as never;
      },
      async createSessionCookie() {
        return "session-cookie-value";
      },
      async verifySessionCookie() {
        return {
          uid: "u1",
          email: "admin@example.com",
          email_verified: true,
          iat: now,
        } as never;
      },
    };
  }

  it("accepts allowlisted verified recent auth", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_MODE", "firebase");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo");
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "admin@example.com");
    resetServerEnvCacheForTests();

    const result = await createAdminSessionFromIdToken({
      idToken: "token-value-long-enough",
      authPort: fakePort(),
      accessPolicy: allowAll,
    });
    expect(result.cookieValue).toBe("session-cookie-value");
    expect(result.principal.email).toBe("admin@example.com");
    expect(result.principal.role).toBe("admin");
  });

  it("rejects non-allowlisted and unverified and stale", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_MODE", "firebase");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo");
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "admin@example.com");
    resetServerEnvCacheForTests();

    await expect(
      createAdminSessionFromIdToken({
        idToken: "token-value-long-enough",
        authPort: fakePort({ email: "other@example.com" }),
        accessPolicy: allowAll,
      }),
    ).rejects.toBeInstanceOf(SessionError);

    await expect(
      createAdminSessionFromIdToken({
        idToken: "token-value-long-enough",
        authPort: fakePort({ emailVerified: false }),
        accessPolicy: allowAll,
      }),
    ).rejects.toBeInstanceOf(SessionError);

    const now = Math.floor(Date.now() / 1000);
    await expect(
      createAdminSessionFromIdToken({
        idToken: "token-value-long-enough",
        nowSeconds: now,
        authPort: fakePort({
          auth_time: now - RECENT_AUTH_MAX_AGE_SECONDS - 10,
        }),
        accessPolicy: allowAll,
      }),
    ).rejects.toBeInstanceOf(SessionError);
  });

  it("verifies session cookie and rejects missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_MODE", "firebase");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo");
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "admin@example.com");
    resetServerEnvCacheForTests();

    const principal = await verifyAdminSessionCookie({
      cookieValue: "cookie",
      authPort: fakePort(),
      accessPolicy: allowAll,
    });
    expect(principal?.email).toBe("admin@example.com");
    expect(
      await verifyAdminSessionCookie({
        cookieValue: undefined,
        authPort: fakePort(),
      }),
    ).toBeNull();
  });
});

describe("origin and modes", () => {
  it("allows localhost origins", () => {
    vi.stubEnv("NODE_ENV", "test");
    resetServerEnvCacheForTests();
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });

  it("defaults auth disabled and content demo in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_MODE", undefined);
    vi.stubEnv("CONTENT_SOURCE_MODE", undefined);
    resetServerEnvCacheForTests();
    expect(getAuthMode()).toBe("disabled");
    expect(getContentSourceMode()).toBe("demo");
  });
});
