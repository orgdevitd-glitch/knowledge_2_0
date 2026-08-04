import "server-only";

import type {
  AssistantProviderPort,
  AssistantProviderGenerateRequest,
} from "@/server/repositories/interfaces/assistant-provider-port";
import type { AssistantProviderResult } from "@/domain/assistant/types";

/** Always unavailable — used when ASSISTANT_MODE=disabled. */
export class DisabledAssistantProviderAdapter implements AssistantProviderPort {
  async generateGroundedAnswer(
    _request: AssistantProviderGenerateRequest,
    signal: AbortSignal,
  ): Promise<AssistantProviderResult> {
    if (signal.aborted) {
      return {
        kind: "refused",
        refusalCategory: "provider_unavailable",
        usage: emptyUsage(),
        finishReason: "cancelled",
        providerStatus: "unavailable",
      };
    }
    return {
      kind: "refused",
      refusalCategory: "provider_unavailable",
      usage: emptyUsage(),
      finishReason: "unavailable",
      providerStatus: "unavailable",
    };
  }
}

function emptyUsage() {
  return {
    inputCharacters: 0,
    outputCharacters: 0,
    evidenceSourceCount: 0,
    evidenceChunkCount: 0,
  };
}
