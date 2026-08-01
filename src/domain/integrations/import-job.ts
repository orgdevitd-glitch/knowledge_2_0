import { z } from "zod";

import { ValidationError } from "../shared/errors";
import type { UserId } from "../shared/ids";
import { UserId as UserIdP } from "../shared/ids";
import type { IsoDateTime } from "../shared/value-objects";
import { parseIsoDateTime } from "../shared/value-objects";

export const IMPORT_JOB_TYPES = [
  "google-docs-article",
  "google-sheets-prompts",
] as const;
export type ImportJobType = (typeof IMPORT_JOB_TYPES)[number];

export const IMPORT_JOB_TARGET_ENTITY_TYPES = ["article", "prompt-batch"] as const;
export type ImportJobTargetEntityType =
  (typeof IMPORT_JOB_TARGET_ENTITY_TYPES)[number];

export const IMPORT_JOB_STATUSES = [
  "preparing",
  "ready",
  "invalid",
  "confirmed",
  "failed",
  "expired",
  "cancelled",
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export type ImportWarning = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type ImportError = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type ImportJobPreview = Record<string, unknown>;

export type ImportJob = {
  id: string;
  sourceConnectionId: string | null;
  sourceExternalId: string;
  sourceVersion: string | null;
  sourceModifiedAt: IsoDateTime | null;
  sourceChecksum: string | null;
  importType: ImportJobType;
  targetEntityType: ImportJobTargetEntityType;
  targetEntityId: string | null;
  status: ImportJobStatus;
  preview: ImportJobPreview | null;
  warnings: ImportWarning[];
  errors: ImportError[];
  createdBy: UserId;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
  confirmedAt: IsoDateTime | null;
  confirmedBy: UserId | null;
  resultEntityIds: string[];
  idempotencyKey: string | null;
};

const importWarningSchema = z.object({
  code: z.string().min(1).max(128),
  message: z.string().min(1).max(2048),
  context: z.record(z.string(), z.unknown()).optional(),
});

const importErrorSchema = importWarningSchema;

const importJobSchema = z.object({
  id: z.string().min(1).max(128),
  sourceConnectionId: z.string().min(1).max(128).nullable(),
  sourceExternalId: z.string().min(1).max(256),
  sourceVersion: z.string().max(128).nullable(),
  sourceModifiedAt: z.string().nullable(),
  sourceChecksum: z.string().max(128).nullable(),
  importType: z.enum(IMPORT_JOB_TYPES),
  targetEntityType: z.enum(IMPORT_JOB_TARGET_ENTITY_TYPES),
  targetEntityId: z.string().min(1).max(128).nullable(),
  status: z.enum(IMPORT_JOB_STATUSES),
  preview: z.record(z.string(), z.unknown()).nullable(),
  warnings: z.array(importWarningSchema),
  errors: z.array(importErrorSchema),
  createdBy: z.string().min(1).max(128),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  confirmedBy: z.string().min(1).max(128).nullable(),
  resultEntityIds: z.array(z.string().min(1).max(128)),
  idempotencyKey: z.string().max(512).nullable(),
});

export function parseImportJob(value: unknown): ImportJob {
  const parsed = importJobSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("Invalid ImportJob", {
      issues: parsed.error.issues.map((i) => i.message),
    });
  }
  const data = parsed.data;
  return {
    id: data.id,
    sourceConnectionId: data.sourceConnectionId,
    sourceExternalId: data.sourceExternalId,
    sourceVersion: data.sourceVersion,
    sourceModifiedAt: data.sourceModifiedAt
      ? parseIsoDateTime(data.sourceModifiedAt)
      : null,
    sourceChecksum: data.sourceChecksum,
    importType: data.importType,
    targetEntityType: data.targetEntityType,
    targetEntityId: data.targetEntityId,
    status: data.status,
    preview: data.preview,
    warnings: data.warnings,
    errors: data.errors,
    createdBy: UserIdP.parse(data.createdBy),
    createdAt: parseIsoDateTime(data.createdAt),
    expiresAt: data.expiresAt ? parseIsoDateTime(data.expiresAt) : null,
    confirmedAt: data.confirmedAt ? parseIsoDateTime(data.confirmedAt) : null,
    confirmedBy: data.confirmedBy ? UserIdP.parse(data.confirmedBy) : null,
    resultEntityIds: data.resultEntityIds,
    idempotencyKey: data.idempotencyKey,
  };
}

export function isImportJobExpired(
  job: ImportJob,
  now: Date = new Date(),
): boolean {
  if (job.status === "expired") return true;
  if (!job.expiresAt) return false;
  return Date.parse(job.expiresAt) <= now.getTime();
}
