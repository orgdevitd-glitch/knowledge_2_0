import { afterEach, describe, expect, it, vi } from "vitest";

import { resetAssistantEnvCacheForTests } from "@/config/assistant-env";
import { resetServerEnvCacheForTests } from "@/config/env";
import { getPublicAssistantCapability } from "@/server/composition/assistant-ui-capability";
import { resetAssistantTestEnv } from "./helpers";

describe("public assistant capability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetAssistantTestEnv("fake");
  });

  it("returns unavailable when disabled", () => {
    resetAssistantTestEnv("disabled");
    const cap = getPublicAssistantCapability();
    expect(cap).toEqual({
      available: false,
      demonstration: false,
      questionMinLength: 3,
      questionMaxLength: 500,
    });
  });

  it("enables demonstration in test fake mode", () => {
    resetAssistantTestEnv("fake");
    const cap = getPublicAssistantCapability();
    expect(cap.available).toBe(true);
    expect(cap.demonstration).toBe(true);
    expect(cap.questionMinLength).toBe(3);
    expect(cap.questionMaxLength).toBe(500);
  });

  it("enables demonstration in development fake mode", () => {
    resetAssistantTestEnv("fake");
    vi.stubEnv("NODE_ENV", "development");
    resetServerEnvCacheForTests();
    resetAssistantEnvCacheForTests();
    const cap = getPublicAssistantCapability();
    expect(cap.available).toBe(true);
    expect(cap.demonstration).toBe(true);
  });

  it("fail-closes production fake as unavailable", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ASSISTANT_MODE", "fake");
    vi.stubEnv("PERSISTENCE_MODE", "memory");
    resetServerEnvCacheForTests();
    resetAssistantEnvCacheForTests();
    const cap = getPublicAssistantCapability();
    expect(cap.available).toBe(false);
    expect(cap.demonstration).toBe(false);
  });

  it("fail-closes invalid config as unavailable", () => {
    resetAssistantTestEnv("disabled");
    vi.stubEnv("ASSISTANT_MAX_SOURCES", "9999");
    resetAssistantEnvCacheForTests();
    const cap = getPublicAssistantCapability();
    expect(cap.available).toBe(false);
    expect(cap.demonstration).toBe(false);
  });

  it("treats missing ASSISTANT_MODE as unavailable", () => {
    resetAssistantTestEnv("disabled");
    vi.stubEnv("ASSISTANT_MODE", "");
    resetAssistantEnvCacheForTests();
    const cap = getPublicAssistantCapability();
    expect(cap.available).toBe(false);
    expect(cap.demonstration).toBe(false);
  });

  it("fail-closes parser exceptions without logging raw env", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    resetAssistantTestEnv("disabled");
    vi.stubEnv("ASSISTANT_MODE", "openai-secret-mode");
    resetAssistantEnvCacheForTests();
    const cap = getPublicAssistantCapability();
    expect(cap).toEqual({
      available: false,
      demonstration: false,
      questionMinLength: 3,
      questionMaxLength: 500,
    });
    const logged = [...log.mock.calls, ...info.mock.calls, ...error.mock.calls, ...warn.mock.calls, ...debug.mock.calls]
      .map((c) => JSON.stringify(c))
      .join("\n");
    expect(logged).not.toMatch(/openai-secret-mode|ASSISTANT_MODE/);
  });

  it("projection excludes mode provider policy and internal limits", () => {
    resetAssistantTestEnv("fake");
    const cap = getPublicAssistantCapability();
    const json = JSON.stringify(cap);
    expect(json).not.toMatch(/ASSISTANT_MODE|fake|disabled|provider|model|policy|timeout|evidence|token/i);
    expect(cap).not.toHaveProperty("mode");
    expect(cap).not.toHaveProperty("provider");
    expect(cap).not.toHaveProperty("policyVersion");
    expect(cap).not.toHaveProperty("environment");
    expect(cap).not.toHaveProperty("rateLimit");
    expect(Object.keys(cap).sort()).toEqual(
      ["available", "demonstration", "questionMaxLength", "questionMinLength"].sort(),
    );
  });
});
