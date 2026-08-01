import "server-only";

import { ValidationError } from "@/domain/shared/errors";

export const GOOGLE_WORKSPACE_URL_PROVIDERS = ["google-workspace"] as const;
export type GoogleWorkspaceUrlProvider =
  (typeof GOOGLE_WORKSPACE_URL_PROVIDERS)[number];

export const GOOGLE_WORKSPACE_RESOURCE_TYPES = [
  "document",
  "spreadsheet",
  "drive-file",
  "drive-folder",
  "unknown-id",
] as const;
export type GoogleWorkspaceResourceType =
  (typeof GOOGLE_WORKSPACE_RESOURCE_TYPES)[number];

export type ParsedGoogleWorkspaceUrl = {
  provider: GoogleWorkspaceUrlProvider;
  resourceType: GoogleWorkspaceResourceType;
  externalId: string;
};

const UNSAFE_SCHEME_RE = /^(javascript|data|vbscript|file):/i;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;
const GOOGLE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,256}$/;

const DOCS_DOC_RE =
  /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/;
const SHEETS_RE =
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/;
const DRIVE_FILE_RE =
  /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/;
const DRIVE_FOLDER_RE =
  /^https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/;

function rejectUnsafeInput(raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ValidationError("Google Workspace URL or ID is empty");
  }
  if (CONTROL_CHARS_RE.test(trimmed)) {
    throw new ValidationError("Google Workspace input contains control characters");
  }
  if (UNSAFE_SCHEME_RE.test(trimmed)) {
    throw new ValidationError("Unsafe URL scheme is not allowed");
  }
}

function parseAsUrl(input: string): ParsedGoogleWorkspaceUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError("Invalid Google Workspace URL");
  }

  if (url.username || url.password) {
    throw new ValidationError("URL credentials are not allowed");
  }

  if (url.protocol !== "https:") {
    throw new ValidationError("Only HTTPS Google URLs are supported");
  }

  const href = url.href;

  const docMatch = DOCS_DOC_RE.exec(href);
  if (docMatch?.[1]) {
    return {
      provider: "google-workspace",
      resourceType: "document",
      externalId: docMatch[1],
    };
  }

  const sheetMatch = SHEETS_RE.exec(href);
  if (sheetMatch?.[1]) {
    return {
      provider: "google-workspace",
      resourceType: "spreadsheet",
      externalId: sheetMatch[1],
    };
  }

  const fileMatch = DRIVE_FILE_RE.exec(href);
  if (fileMatch?.[1]) {
    return {
      provider: "google-workspace",
      resourceType: "drive-file",
      externalId: fileMatch[1],
    };
  }

  const folderMatch = DRIVE_FOLDER_RE.exec(href);
  if (folderMatch?.[1]) {
    return {
      provider: "google-workspace",
      resourceType: "drive-folder",
      externalId: folderMatch[1],
    };
  }

  throw new ValidationError("Unsupported Google Workspace URL host or path");
}

function parseAsRawId(input: string): ParsedGoogleWorkspaceUrl {
  const id = input.trim();
  if (!GOOGLE_FILE_ID_RE.test(id)) {
    throw new ValidationError("Invalid Google file or folder ID format");
  }
  return {
    provider: "google-workspace",
    resourceType: "unknown-id",
    externalId: id,
  };
}

/**
 * Parses a Google Docs/Sheets/Drive URL or raw file/folder ID.
 * Does not perform HTTP fetches; MIME type must be verified server-side via Drive API.
 */
export function parseGoogleWorkspaceUrl(
  input: string,
): ParsedGoogleWorkspaceUrl {
  rejectUnsafeInput(input);
  const trimmed = input.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return parseAsUrl(trimmed);
  }

  return parseAsRawId(trimmed);
}
