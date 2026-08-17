import { ASSISTANT_POLICY_VERSION } from "./limits";

/**
 * Policy version constant only — full policy text lives server-side
 * (`src/server/assistant/system-policy.ts`) and must never enter client bundles.
 */
export const ASSISTANT_SYSTEM_POLICY_VERSION = ASSISTANT_POLICY_VERSION;
