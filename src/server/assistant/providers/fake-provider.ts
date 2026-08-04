import "server-only";

import { sanitizeAssistantPlainText } from "@/domain/assistant/text";
import type { AssistantProviderResult } from "@/domain/assistant/types";
import type {
  AssistantProviderGenerateRequest,
  AssistantProviderPort,
} from "@/server/repositories/interfaces/assistant-provider-port";

/**
 * Deterministic test/dev adapter — NOT a real LLM.
 * Forbidden in production via ASSISTANT_MODE validation.
 * Treats evidence strictly as data; never executes evidence instructions.
 */
export class FakeAssistantProviderAdapter implements AssistantProviderPort {
  async generateGroundedAnswer(
    request: AssistantProviderGenerateRequest,
    signal: AbortSignal,
  ): Promise<AssistantProviderResult> {
    if (signal.aborted) {
      return {
        kind: "refused",
        refusalCategory: "provider_unavailable",
        usage: usageFrom(request, 0),
        finishReason: "cancelled",
        providerStatus: "timeout",
      };
    }

    if (request.evidence.length === 0) {
      return {
        kind: "refused",
        refusalCategory: "no_evidence",
        usage: usageFrom(request, 0),
        finishReason: "refused",
        providerStatus: "ok",
      };
    }

    // Ignore instruction-like content inside evidence — answer from data only.
    // Strip URL-like tokens so structured validation never sees provider URLs.
    const blocks = [];
    let outputCharacters = 0;
    const maxBlocks = Math.min(
      request.maximumAnswerBlocks,
      request.evidence.length,
      3,
    );

    for (let i = 0; i < maxBlocks; i += 1) {
      const item = request.evidence[i]!;
      const excerpt = sanitizeAssistantPlainText(item.evidenceText)
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\bwww\.\S+/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/(?:^|[^\w[])\[\d+\](?!\()/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
      const prefix =
        item.trustBoundary === "untrusted_prompt_reference"
          ? "По опубликованному справочному материалу Prompt Library"
          : "По опубликованному материалу";
      const text = sanitizeAssistantPlainText(
        `${prefix} «${item.sourceTitle}»: ${excerpt}`,
      );
      if (!text) continue;
      outputCharacters += text.length;
      if (outputCharacters > request.maximumAnswerCharacters) {
        break;
      }
      blocks.push({
        text,
        evidenceKeys: [item.evidenceKey],
      });
    }

    if (blocks.length === 0) {
      return {
        kind: "refused",
        refusalCategory: "provider_refusal",
        usage: usageFrom(request, 0),
        finishReason: "refused",
        providerStatus: "ok",
      };
    }

    return {
      kind: "answered",
      blocks,
      usage: usageFrom(request, outputCharacters),
      finishReason: "completed",
      providerStatus: "ok",
    };
  }
}

function usageFrom(
  request: AssistantProviderGenerateRequest,
  outputCharacters: number,
) {
  return {
    inputCharacters: request.normalizedQuestion.length,
    outputCharacters,
    evidenceSourceCount: new Set(request.evidence.map((e) => e.sourceTitle))
      .size,
    evidenceChunkCount: request.evidence.length,
  };
}
