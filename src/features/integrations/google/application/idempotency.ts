import { createHash } from "node:crypto";

export function buildImportIdempotencyKey(parts: {
  importJobId: string;
  sourceExternalId: string;
  sourceVersion: string | null;
  targetEntityType: string;
  targetEntityId: string | null;
  operation: string;
}): string {
  return [
    parts.importJobId,
    parts.sourceExternalId,
    parts.sourceVersion ?? "null",
    parts.targetEntityType,
    parts.targetEntityId ?? "create-new",
    parts.operation,
  ].join("|");
}

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
