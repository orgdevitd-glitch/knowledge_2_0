import "server-only";

import { GoogleWorkspaceError } from "../errors";

export type GoogleRetryOptions = {
  maxAttempts: number;
  timeoutMs: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** When true, retries on retryable GoogleWorkspaceError codes. */
  isSafeRead?: boolean;
};

const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterHeader(value: string | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, DEFAULT_MAX_DELAY_MS);
  }
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.min(dateMs - Date.now(), DEFAULT_MAX_DELAY_MS));
  }
  return null;
}

function extractRetryAfter(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response: { headers?: Record<string, string> } }).response
      ?.headers
  ) {
    const headers = (error as { response: { headers: Record<string, string> } })
      .response.headers;
    return parseRetryAfterHeader(headers["retry-after"] ?? headers["Retry-After"]);
  }
  return null;
}

function computeBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = Math.floor(Math.random() * capped * 0.25);
  return capped + jitter;
}

function isRetryableError(error: unknown, isSafeRead: boolean): boolean {
  if (!isSafeRead) return false;
  if (error instanceof GoogleWorkspaceError) {
    return error.retryable;
  }
  const status =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number"
      ? (error as { code: number }).code
      : undefined;
  return status === 429 || status === 408 || (status !== undefined && status >= 500);
}

function isNonRetryableClientError(error: unknown): boolean {
  const status =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number"
      ? (error as { code: number }).code
      : undefined;
  return status === 400 || status === 401 || status === 403 || status === 404;
}

async function runWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GoogleWorkspaceError(
        "GOOGLE_API_TIMEOUT",
        "Google API request timed out",
        { timeoutMs },
        { retryable: true },
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a Google API read with timeout, bounded retries, exponential backoff,
 * jitter, and Retry-After support.
 */
export async function withGoogleRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: GoogleRetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    timeoutMs,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    isSafeRead = true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await runWithTimeout(operation, timeoutMs);
    } catch (error) {
      lastError = error;

      if (isNonRetryableClientError(error)) {
        throw error;
      }

      const shouldRetry =
        attempt < maxAttempts && isRetryableError(error, isSafeRead);

      if (!shouldRetry) {
        throw error;
      }

      const retryAfterMs = extractRetryAfter(error);
      const delayMs =
        retryAfterMs ??
        computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
