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
  externalId?: string;
  externalUrl?: SafeUrl;
  lastKnownModifiedAt?: IsoDateTime;
  lastSyncAt?: IsoDateTime;
  checksum?: string;
};

const sourceSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  externalId: z.string().min(1).max(256).optional(),
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

export function portalSource(): SourceReference {
  return { type: "portal" };
}
