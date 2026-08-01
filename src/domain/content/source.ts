import { z } from "zod";

import { ValidationError } from "../shared/errors";
import { parseSafeUrl, type SafeUrl } from "../shared/url";
import type { IsoDateTime } from "../shared/value-objects";
import { parseIsoDateTime } from "../shared/value-objects";

export const SOURCE_TYPES = [
  "portal",
  "google-docs",
  "google-sheets",
  "google-drive",
  "manual-import",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type SourceReference = {
  type: SourceType;
  /** Row/document external id within the source namespace. */
  externalId?: string;
  /**
   * SourceConnection id for Google imports (scopes externalId uniqueness).
   * Not a second provenance store — part of the same SourceReference.
   */
  connectionId?: string;
  /** Last confirmed ImportJob id (admin provenance only). */
  lastImportJobId?: string;
  externalUrl?: SafeUrl;
  lastKnownModifiedAt?: IsoDateTime;
  lastSyncAt?: IsoDateTime;
  checksum?: string;
};

const sourceSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  externalId: z.string().min(1).max(256).optional(),
  connectionId: z.string().min(1).max(128).optional(),
  lastImportJobId: z.string().min(1).max(128).optional(),
  externalUrl: z.string().max(2048).optional(),
  lastKnownModifiedAt: z.string().optional(),
  lastSyncAt: z.string().optional(),
  checksum: z.string().max(128).optional(),
});

export function parseSourceReference(value: unknown): SourceReference {
  const parsed = sourceSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("Invalid SourceReference");
  }
  const data = parsed.data;
  return {
    type: data.type,
    externalId: data.externalId,
    connectionId: data.connectionId,
    lastImportJobId: data.lastImportJobId,
    externalUrl: data.externalUrl
      ? parseSafeUrl(data.externalUrl, {
          requireHttpsAbsolute: true,
          allowRelative: false,
        })
      : undefined,
    lastKnownModifiedAt: data.lastKnownModifiedAt
      ? parseIsoDateTime(data.lastKnownModifiedAt)
      : undefined,
    lastSyncAt: data.lastSyncAt
      ? parseIsoDateTime(data.lastSyncAt)
      : undefined,
    checksum: data.checksum,
  };
}

/** Stable key for source-scoped external id uniqueness. */
export function sourceExternalKey(
  sourceType: SourceType,
  connectionId: string | undefined,
  externalId: string,
): string {
  const ns = connectionId?.trim() || "_";
  return `${sourceType}:${ns}:${externalId}`;
}

export function portalSource(): SourceReference {
  return { type: "portal" };
}
