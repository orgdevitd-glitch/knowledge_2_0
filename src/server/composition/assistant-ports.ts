import "server-only";

import { getAssistantConfig } from "@/config/assistant-env";
import { ContentPortsAssistantContentAdapter } from "@/server/assistant/content-ports-assistant-content";
import { DisabledAssistantProviderAdapter } from "@/server/assistant/providers/disabled-provider";
import { FakeAssistantProviderAdapter } from "@/server/assistant/providers/fake-provider";
import { getAssistantRateLimiter } from "@/server/assistant/rate-limit";
import { SearchBackedAssistantRetrieval } from "@/server/assistant/search-backed-retrieval";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  getPublicSearchVisibility,
  getSearchIndex,
} from "@/server/composition/search-ports";
import type { AssistantProviderPort } from "@/server/repositories/interfaces/assistant-provider-port";
import type { AssistantRateLimitPort } from "@/server/repositories/interfaces/assistant-rate-limit-port";
import type { AssistantRetrievalPort } from "@/server/repositories/interfaces/assistant-retrieval-port";
import type { PublicAssistantContentPort } from "@/server/repositories/interfaces/assistant-content-port";

let retrieval: AssistantRetrievalPort | null = null;
let content: PublicAssistantContentPort | null = null;

export function getAssistantContentPort(): PublicAssistantContentPort {
  content ??= new ContentPortsAssistantContentAdapter(getContentPorts());
  return content;
}

export function getAssistantRetrievalPort(): AssistantRetrievalPort {
  retrieval ??= new SearchBackedAssistantRetrieval(
    getSearchIndex(),
    getPublicSearchVisibility(),
    getAssistantContentPort(),
  );
  return retrieval;
}

export function getAssistantProviderPort(): AssistantProviderPort {
  const mode = getAssistantConfig().mode;
  if (mode === "fake") {
    return new FakeAssistantProviderAdapter();
  }
  return new DisabledAssistantProviderAdapter();
}

export function getAssistantRateLimitPort(): AssistantRateLimitPort {
  return getAssistantRateLimiter();
}

export function resetAssistantCompositionForTests(): void {
  retrieval = null;
  content = null;
}
