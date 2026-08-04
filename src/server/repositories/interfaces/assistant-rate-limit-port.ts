export type AssistantRateLimitTakeResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: "rate_limit" | "concurrency";
};

/**
 * Abstraction over assistant abuse controls.
 * In-process implementations are for tests/local/fake only —
 * not sufficient distributed cost protection for a real LLM.
 */
export interface AssistantRateLimitPort {
  take(key: string): AssistantRateLimitTakeResult;
  acquireConcurrency(key: string): {
    allowed: boolean;
    release: () => void;
  };
}
