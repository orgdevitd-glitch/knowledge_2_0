import "server-only";

import { InProcessRateLimiter } from "@/server/auth/rate-limit";
import type { AssistantRateLimitPort } from "@/server/repositories/interfaces/assistant-rate-limit-port";
import { getAssistantConfig } from "@/config/assistant-env";

/**
 * In-process limiter for tests / local / fake foundation only.
 * Not sufficient distributed cost protection for a real LLM provider.
 */
export class InProcessAssistantRateLimitAdapter
  implements AssistantRateLimitPort
{
  private limiter: InProcessRateLimiter;
  private readonly inFlight = new Map<string, number>();
  private readonly maxConcurrent: number;

  constructor(options?: {
    limit?: number;
    windowMs?: number;
    maxConcurrent?: number;
  }) {
    const cfg = getAssistantConfig();
    this.limiter = new InProcessRateLimiter(
      options?.limit ?? cfg.rateLimitRequestsPerWindow,
      options?.windowMs ?? cfg.rateLimitWindowMs,
    );
    this.maxConcurrent =
      options?.maxConcurrent ?? cfg.maxConcurrentRequests;
  }

  take(key: string) {
    const result = this.limiter.take(key);
    if (!result.allowed) {
      return {
        allowed: false as const,
        retryAfterSeconds: result.retryAfterSeconds,
        reason: "rate_limit" as const,
      };
    }
    return { allowed: true as const };
  }

  acquireConcurrency(key: string) {
    const current = this.inFlight.get(key) ?? 0;
    if (current >= this.maxConcurrent) {
      return {
        allowed: false as const,
        release: () => undefined,
      };
    }
    this.inFlight.set(key, current + 1);
    let released = false;
    return {
      allowed: true as const,
      release: () => {
        if (released) return;
        released = true;
        const next = (this.inFlight.get(key) ?? 1) - 1;
        if (next <= 0) this.inFlight.delete(key);
        else this.inFlight.set(key, next);
      },
    };
  }

  clearForTests(): void {
    this.limiter.clear();
    this.inFlight.clear();
  }
}

let shared: InProcessAssistantRateLimitAdapter | null = null;

export function getAssistantRateLimiter(): AssistantRateLimitPort {
  shared ??= new InProcessAssistantRateLimitAdapter();
  return shared;
}

export function getAssistantRateLimiterForTests(): InProcessAssistantRateLimitAdapter {
  shared ??= new InProcessAssistantRateLimitAdapter();
  return shared;
}

export function resetAssistantRateLimiterForTests(): void {
  shared?.clearForTests();
  shared = null;
}
