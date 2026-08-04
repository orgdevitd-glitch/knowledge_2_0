import "server-only";

/**
 * Builds a rate-limit identity key for the public assistant.
 *
 * Production distributed identity / trusted-proxy X-Forwarded-For handling is
 * NOT implemented in Phase 8C.1. The in-process limiter is for test/local/fake
 * only. Raw IP must never be logged.
 */
export function assistantRateLimitKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate =
    forwarded?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
  // Opaque key material only — do not log `candidate`.
  return `assistant:${candidate}`;
}
