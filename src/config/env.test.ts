import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAppEnvironment,
  getAuthMode,
  getContentSourceMode,
  getLogLevel,
  getServerEnv,
  resetServerEnvCacheForTests,
} from "@/config/env";
import {
  getPublicEnv,
  resetPublicEnvCacheForTests,
} from "@/config/public-env";

afterEach(() => {
  resetServerEnvCacheForTests();
  resetPublicEnvCacheForTests();
  vi.unstubAllEnvs();
});

describe("server env", () => {
  it("parses defaults without optional integration vars", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", undefined);
    vi.stubEnv("LOG_LEVEL", undefined);
    vi.stubEnv("CONTENT_SOURCE_MODE", undefined);
    vi.stubEnv("AUTH_MODE", undefined);

    const env = getServerEnv();

    expect(env.NODE_ENV).toBe("test");
    expect(getAppEnvironment()).toBe("test");
    expect(getLogLevel()).toBe("debug");
    expect(getContentSourceMode()).toBe("demo");
    expect(getAuthMode()).toBe("disabled");
  });

  it("defaults production content source to empty", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONTENT_SOURCE_MODE", undefined);
    vi.stubEnv("AUTH_MODE", "disabled");
    expect(getContentSourceMode()).toBe("empty");
  });

  it("forbids demo mode in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONTENT_SOURCE_MODE", "demo");
    expect(() => getServerEnv()).toThrow(/demo is forbidden/i);
  });

  it("forbids memory persistence in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSISTENCE_MODE", "memory");
    expect(() => getServerEnv()).toThrow(/memory is forbidden/i);
  });

  it("requires allowlist for firebase auth mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_MODE", "firebase");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo");
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", undefined);
    expect(() => getServerEnv()).toThrow(/allowlist/i);
  });

  it("honors APP_ENV and LOG_LEVEL when provided", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("LOG_LEVEL", "warn");
    vi.stubEnv("CONTENT_SOURCE_MODE", "empty");
    vi.stubEnv("AUTH_MODE", "disabled");

    expect(getAppEnvironment()).toBe("staging");
    expect(getLogLevel()).toBe("warn");
  });

  it("rejects invalid LOG_LEVEL with a clear error", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "verbose");

    expect(() => getServerEnv()).toThrow(/Invalid server environment/i);
  });
});

describe("public env", () => {
  it("defaults app name when NEXT_PUBLIC_APP_NAME is omitted", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", undefined);

    expect(getPublicEnv().NEXT_PUBLIC_APP_NAME).toBe(
      "Corporate Knowledge Portal",
    );
  });
});
