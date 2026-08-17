import { vi } from "vitest";

import { resetAssistantEnvCacheForTests } from "@/config/assistant-env";
import { resetSearchEnvCacheForTests } from "@/config/search-env";
import { resetServerEnvCacheForTests } from "@/config/env";
import {
  resetAssistantCompositionForTests,
} from "@/server/composition/assistant-ports";
import { resetAdminPersistenceForTests } from "@/server/composition/admin-persistence";
import { resetSearchCompositionForTests } from "@/server/composition/search-ports";
import {
  resetAssistantRateLimiterForTests,
} from "@/server/assistant/rate-limit";

export function resetAssistantTestEnv(mode: "disabled" | "fake" = "fake") {
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ASSISTANT_MODE", mode);
  vi.stubEnv("SEARCH_INDEX_MODE", "memory");
  vi.stubEnv("PERSISTENCE_MODE", "memory");
  vi.stubEnv(
    "SEARCH_CURSOR_HMAC_SECRET",
    "test-search-cursor-hmac-secret-fixture-32b",
  );
  resetServerEnvCacheForTests();
  resetSearchEnvCacheForTests();
  resetAssistantEnvCacheForTests();
  resetAdminPersistenceForTests();
  resetSearchCompositionForTests();
  resetAssistantCompositionForTests();
  resetAssistantRateLimiterForTests();
}

export function assistantAskHeaders(
  overrides: Record<string, string> = {},
): HeadersInit {
  return {
    "content-type": "application/json",
    origin: "http://localhost:3000",
    "sec-fetch-site": "same-origin",
    "x-forwarded-for": `assistant-test-${Date.now()}-${Math.random()}`,
    ...overrides,
  };
}
