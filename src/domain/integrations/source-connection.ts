import { z } from "zod";

import { ValidationError } from "../shared/errors";
import type { UserId } from "../shared/ids";
import { UserId as UserIdP } from "../shared/ids";
import type { IsoDateTime } from "../shared/value-objects";
import { parseIsoDateTime } from "../shared/value-objects";

export const SOURCE_CONNECTION_PROVIDERS = ["google-workspace"] as const;
export type SourceConnectionProvider =
  (typeof SOURCE_CONNECTION_PROVIDERS)[number];

export const SOURCE_CONNECTION_SOURCE_TYPES = [
  "google-docs",
  "google-sheets",
  "google-drive-folder",
] as const;
export type SourceConnectionSourceType =
  (typeof SOURCE_CONNECTION_SOURCE_TYPES)[number];

export const SOURCE_CONNECTION_TARGET_ENTITY_TYPES = [
  "article",
  "prompt-batch",
  "none",
] as const;
export type SourceConnectionTargetEntityType =
  (typeof SOURCE_CONNECTION_TARGET_ENTITY_TYPES)[number];

export const SOURCE_CONNECTION_STATUSES = [
  "active",
  "access-lost",
  "unsupported",
  "archived",
] as const;
export type SourceConnectionStatus =
  (typeof SOURCE_CONNECTION_STATUSES)[number];

export type SourceConnection = {
  id: string;
  provider: SourceConnectionProvider;
  sourceType: SourceConnectionSourceType;
  externalId: string;
  sharedDriveId: string;
  rootFolderId: string;
  targetEntityType: SourceConnectionTargetEntityType;
  targetEntityId: string | null;
  displayName: string;
  mimeType: string;
  status: SourceConnectionStatus;
  lastKnownModifiedAt: IsoDateTime | null;
  lastKnownVersion: string | null;
  lastImportedChecksum: string | null;
  lastImportedAt: IsoDateTime | null;
  createdBy: UserId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  revision: number;
};

const sourceConnectionSchema = z.object({
  id: z.string().min(1).max(128),
  provider: z.enum(SOURCE_CONNECTION_PROVIDERS),
  sourceType: z.enum(SOURCE_CONNECTION_SOURCE_TYPES),
  externalId: z.string().min(1).max(256),
  sharedDriveId: z.string().min(1).max(256),
  rootFolderId: z.string().min(1).max(256),
  targetEntityType: z.enum(SOURCE_CONNECTION_TARGET_ENTITY_TYPES),
  targetEntityId: z.string().min(1).max(128).nullable(),
  displayName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(256),
  status: z.enum(SOURCE_CONNECTION_STATUSES),
  lastKnownModifiedAt: z.string().nullable(),
  lastKnownVersion: z.string().max(128).nullable(),
  lastImportedChecksum: z.string().max(128).nullable(),
  lastImportedAt: z.string().nullable(),
  createdBy: z.string().min(1).max(128),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative(),
});

export function parseSourceConnection(value: unknown): SourceConnection {
  const parsed = sourceConnectionSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("Invalid SourceConnection", {
      issues: parsed.error.issues.map((i) => i.message),
    });
  }
  const data = parsed.data;
  return {
    id: data.id,
    provider: data.provider,
    sourceType: data.sourceType,
    externalId: data.externalId,
    sharedDriveId: data.sharedDriveId,
    rootFolderId: data.rootFolderId,
    targetEntityType: data.targetEntityType,
    targetEntityId: data.targetEntityId,
    displayName: data.displayName,
    mimeType: data.mimeType,
    status: data.status,
    lastKnownModifiedAt: data.lastKnownModifiedAt
      ? parseIsoDateTime(data.lastKnownModifiedAt)
      : null,
    lastKnownVersion: data.lastKnownVersion,
    lastImportedChecksum: data.lastImportedChecksum,
    lastImportedAt: data.lastImportedAt
      ? parseIsoDateTime(data.lastImportedAt)
      : null,
    createdBy: UserIdP.parse(data.createdBy),
    createdAt: parseIsoDateTime(data.createdAt),
    updatedAt: parseIsoDateTime(data.updatedAt),
    revision: data.revision,
  };
}
