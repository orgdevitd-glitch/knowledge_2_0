import "server-only";

export const GOOGLE_WORKSPACE_ERROR_CODES = [
  "GOOGLE_WORKSPACE_DISABLED",
  "GOOGLE_AUTHENTICATION_FAILED",
  "GOOGLE_ACCESS_DENIED",
  "GOOGLE_FILE_NOT_FOUND",
  "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
  "GOOGLE_SHARED_DRIVE_MISMATCH",
  "GOOGLE_UNSUPPORTED_FILE_TYPE",
  "GOOGLE_API_RATE_LIMITED",
  "GOOGLE_API_TIMEOUT",
  "GOOGLE_API_UNAVAILABLE",
  "GOOGLE_DOCUMENT_INVALID",
  "GOOGLE_SHEET_SCHEMA_INVALID",
  "IMPORT_PREVIEW_EXPIRED",
  "IMPORT_ALREADY_CONFIRMED",
  "IMPORT_CONFLICT",
  "IMPORT_VALIDATION_FAILED",
  "IMPORT_SOURCE_CHANGED",
  "IMPORT_TARGET_CHANGED",
] as const;

export type GoogleWorkspaceErrorCode =
  (typeof GOOGLE_WORKSPACE_ERROR_CODES)[number];

export type GoogleWorkspaceErrorDetails = Record<string, unknown>;

export class GoogleWorkspaceError extends Error {
  readonly code: GoogleWorkspaceErrorCode;
  readonly details: GoogleWorkspaceErrorDetails;
  readonly retryable: boolean;

  constructor(
    code: GoogleWorkspaceErrorCode,
    message: string,
    details: GoogleWorkspaceErrorDetails = {},
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "GoogleWorkspaceError";
    this.code = code;
    this.details = details;
    this.retryable = options?.retryable ?? isRetryableCode(code);
  }
}

function isRetryableCode(code: GoogleWorkspaceErrorCode): boolean {
  return (
    code === "GOOGLE_API_RATE_LIMITED" ||
    code === "GOOGLE_API_TIMEOUT" ||
    code === "GOOGLE_API_UNAVAILABLE"
  );
}

export function isGoogleWorkspaceError(
  error: unknown,
): error is GoogleWorkspaceError {
  return error instanceof GoogleWorkspaceError;
}

/** Maps unknown Google API errors to safe workspace errors without leaking credentials. */
export function mapGoogleApiError(error: unknown): GoogleWorkspaceError {
  if (error instanceof GoogleWorkspaceError) {
    return error;
  }

  const status =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number"
      ? (error as { code: number }).code
      : undefined;

  const message =
    error instanceof Error ? error.message : "Google API request failed";

  if (status === 401 || status === 403) {
    return new GoogleWorkspaceError(
      status === 401 ? "GOOGLE_AUTHENTICATION_FAILED" : "GOOGLE_ACCESS_DENIED",
      "Google Workspace access denied",
      { status },
    );
  }

  if (status === 404) {
    return new GoogleWorkspaceError(
      "GOOGLE_FILE_NOT_FOUND",
      "Google file not found",
      { status },
    );
  }

  if (status === 429) {
    return new GoogleWorkspaceError(
      "GOOGLE_API_RATE_LIMITED",
      "Google API rate limited",
      { status },
      { retryable: true },
    );
  }

  if (status === 408 || message.toLowerCase().includes("timeout")) {
    return new GoogleWorkspaceError(
      "GOOGLE_API_TIMEOUT",
      "Google API request timed out",
      { status },
      { retryable: true },
    );
  }

  if (status !== undefined && status >= 500) {
    return new GoogleWorkspaceError(
      "GOOGLE_API_UNAVAILABLE",
      "Google API temporarily unavailable",
      { status },
      { retryable: true },
    );
  }

  return new GoogleWorkspaceError(
    "GOOGLE_API_UNAVAILABLE",
    "Google API request failed",
    { status, safeMessage: message.slice(0, 200) },
  );
}
