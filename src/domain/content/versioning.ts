import { ValidationError } from "../shared/errors";
import type { UserId, VersionId } from "../shared/ids";
import { UserId as UserIdP, VersionId as VersionIdP } from "../shared/ids";
import type { IsoDateTime, VersionNumber } from "../shared/value-objects";
import { parseVersionNumber } from "../shared/value-objects";
import type { SourceReference } from "./source";
import { portalSource } from "./source";

export type VersionEntityType = "article" | "prompt" | "video";

/**
 * JSON-compatible immutable snapshot payload.
 * Must not contain functions or class instances.
 */
export type VersionSnapshot = Record<string, unknown>;

export type ContentVersion = {
  id: VersionId;
  entityType: VersionEntityType;
  entityId: string;
  versionNumber: VersionNumber;
  snapshot: VersionSnapshot;
  changeSummary: string | null;
  source: SourceReference;
  createdBy: UserId;
  createdAt: IsoDateTime;
};

export function createContentVersion(input: {
  id: string;
  entityType: VersionEntityType;
  entityId: string;
  versionNumber: number;
  snapshot: VersionSnapshot;
  changeSummary?: string | null;
  createdBy: string;
  createdAt: IsoDateTime;
}): ContentVersion {
  const snapshot = ensureSerializableSnapshot(input.snapshot);
  return {
    id: VersionIdP.parse(input.id),
    entityType: input.entityType,
    entityId: input.entityId,
    versionNumber: parseVersionNumber(input.versionNumber),
    snapshot,
    changeSummary: input.changeSummary?.trim() || null,
    source: portalSource(),
    createdBy: UserIdP.parse(input.createdBy),
    createdAt: input.createdAt,
  };
}

export function ensureSerializableSnapshot(
  snapshot: VersionSnapshot,
): VersionSnapshot {
  let json: string;
  try {
    json = JSON.stringify(snapshot);
  } catch {
    throw new ValidationError("Version snapshot is not serializable");
  }
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Version snapshot must be a plain object");
  }
  return parsed as VersionSnapshot;
}

export function nextVersionNumber(latest: number | null): VersionNumber {
  return parseVersionNumber((latest ?? 0) + 1);
}
