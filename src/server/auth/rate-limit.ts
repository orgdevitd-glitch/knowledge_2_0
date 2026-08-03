import "server-only";

/**
 * In-process rate limiter for a single Node instance.
 * Production multi-instance Cloud Run needs a distributed limiter port later.
 */
export interface RateLimiter {
  take(key: string): { allowed: boolean; retryAfterSeconds?: number };
}

type Bucket = { count: number; resetAt: number };

export class InProcessRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(key: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }
    if (existing.count >= this.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      };
    }
    existing.count += 1;
    return { allowed: true };
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const authCsrfLimiter = new InProcessRateLimiter(60, 60_000);
export const authSessionLimiter = new InProcessRateLimiter(20, 60_000);
/** Public search API — per IP bucket key supplied by caller. */
export const publicSearchLimiter = new InProcessRateLimiter(60, 60_000);
/** Suggestions are chatty — separate per-IP bucket. */
export const publicSearchSuggestionsLimiter = new InProcessRateLimiter(
  120,
  60_000,
);
