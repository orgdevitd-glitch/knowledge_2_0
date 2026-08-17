import "server-only";

import { getAssistantConfig } from "@/config/assistant-env";
import { getServerEnv } from "@/config/env";
import { ASSISTANT_LIMIT_DEFAULTS } from "@/domain/assistant/limits";

export type PublicAssistantCapability = {
  available: boolean;
  demonstration: boolean;
  questionMinLength: number;
  questionMaxLength: number;
};

const UNAVAILABLE: PublicAssistantCapability = {
  available: false,
  demonstration: false,
  questionMinLength: ASSISTANT_LIMIT_DEFAULTS.questionMinLength,
  questionMaxLength: ASSISTANT_LIMIT_DEFAULTS.questionMaxLength,
};

/**
 * Safe public projection for Assistant Experience (Phase 8C.2).
 * Never exposes ASSISTANT_MODE, provider, policy, or internal limits.
 * Config failure fails closed (unavailable).
 */
export function getPublicAssistantCapability(): PublicAssistantCapability {
  try {
    const cfg = getAssistantConfig();
    const nodeEnv = getServerEnv().NODE_ENV;
    const available = cfg.mode !== "disabled";
    return {
      available,
      demonstration: available && nodeEnv !== "production",
      questionMinLength: cfg.questionMinLength,
      questionMaxLength: cfg.questionMaxLength,
    };
  } catch {
    return { ...UNAVAILABLE };
  }
}
