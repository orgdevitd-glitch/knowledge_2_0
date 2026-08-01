export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATUS_TRANSITION"
  | "DUPLICATE_SLUG"
  | "UNKNOWN_BLOCK_TYPE"
  | "UNSUPPORTED_BLOCK_SCHEMA_VERSION"
  | "REPOSITORY";

export type DomainErrorDetails = Record<string, unknown>;

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: DomainErrorDetails;

  constructor(
    code: DomainErrorCode,
    message: string,
    details: DomainErrorDetails = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("VALIDATION", message, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("NOT_FOUND", message, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("CONFLICT", message, details);
    this.name = "ConflictError";
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("INVALID_STATUS_TRANSITION", message, details);
    this.name = "InvalidStatusTransitionError";
  }
}

export class DuplicateSlugError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("DUPLICATE_SLUG", message, details);
    this.name = "DuplicateSlugError";
  }
}

export class UnknownBlockTypeError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("UNKNOWN_BLOCK_TYPE", message, details);
    this.name = "UnknownBlockTypeError";
  }
}

export class UnsupportedBlockSchemaVersionError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("UNSUPPORTED_BLOCK_SCHEMA_VERSION", message, details);
    this.name = "UnsupportedBlockSchemaVersionError";
  }
}

export class RepositoryError extends DomainError {
  constructor(message: string, details: DomainErrorDetails = {}) {
    super("REPOSITORY", message, details);
    this.name = "RepositoryError";
  }
}
