import "server-only";

import { z } from "zod";

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);
const authModeSchema = z.enum(["disabled", "firebase"]);
const persistenceModeSchema = z.enum(["memory", "firestore"]);
const contentSourceModeSchema = z.enum(["empty", "demo", "firestore"]);
const googleWorkspaceModeSchema = z.enum(["disabled", "service-account"]);

const DEFAULT_GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS = 3600;
const DEFAULT_GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS = 3;

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((v) => v.toLowerCase());

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(items)];
  for (const item of unique) {
    if (item.includes("*") || item.startsWith("@") || item.endsWith("@")) {
      throw new Error("ADMIN_EMAIL_ALLOWLIST forbids wildcards and domain-only entries");
    }
    const parsed = emailSchema.safeParse(item);
    if (!parsed.success) {
      throw new Error("ADMIN_EMAIL_ALLOWLIST contains an invalid email");
    }
  }
  return unique;
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\\n/g, "\n");
}

function parseGoogleFolderIds(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(items)];
  for (const item of unique) {
    if (!/^[a-zA-Z0-9_-]{10,256}$/.test(item)) {
      throw new Error("GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS contains an invalid folder id");
    }
  }
  return unique;
}

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).optional(),
    LOG_LEVEL: logLevelSchema.optional(),
    CONTENT_SOURCE_MODE: contentSourceModeSchema.optional(),
    AUTH_MODE: authModeSchema.optional(),
    PERSISTENCE_MODE: persistenceModeSchema.optional(),
    SITE_URL: z.string().url().optional(),
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
    FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
    FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
    FIRESTORE_DATABASE_ID: z.string().min(1).optional(),
    FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
    ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
    ADMIN_SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().optional(),
    ADMIN_SESSION_COOKIE_NAME: z.string().min(1).optional(),
    CSRF_COOKIE_NAME: z.string().min(1).optional(),
    GOOGLE_WORKSPACE_MODE: googleWorkspaceModeSchema.optional(),
    GOOGLE_WORKSPACE_PROJECT_ID: z.string().min(1).optional(),
    GOOGLE_WORKSPACE_SHARED_DRIVE_ID: z.string().min(1).optional(),
    GOOGLE_WORKSPACE_ROOT_FOLDER_ID: z.string().min(1).optional(),
    GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS: z.string().optional(),
    GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().optional(),
    GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().max(10).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.CONTENT_SOURCE_MODE === "demo") {
      ctx.addIssue({
        code: "custom",
        path: ["CONTENT_SOURCE_MODE"],
        message: "CONTENT_SOURCE_MODE=demo is forbidden in production",
      });
    }
    if (value.NODE_ENV === "production" && value.PERSISTENCE_MODE === "memory") {
      ctx.addIssue({
        code: "custom",
        path: ["PERSISTENCE_MODE"],
        message: "PERSISTENCE_MODE=memory is forbidden in production",
      });
    }
    if (value.AUTH_MODE === "firebase") {
      if (!value.FIREBASE_PROJECT_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["FIREBASE_PROJECT_ID"],
          message: "Required when AUTH_MODE=firebase",
        });
      }
      const allowlist = value.ADMIN_EMAIL_ALLOWLIST
        ? parseAllowlist(value.ADMIN_EMAIL_ALLOWLIST)
        : [];
      if (allowlist.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["ADMIN_EMAIL_ALLOWLIST"],
          message: "Non-empty allowlist required when AUTH_MODE=firebase",
        });
      }
    }
    if (value.CONTENT_SOURCE_MODE === "firestore" || value.PERSISTENCE_MODE === "firestore") {
      if (!value.FIREBASE_PROJECT_ID && !value.FIRESTORE_EMULATOR_HOST) {
        ctx.addIssue({
          code: "custom",
          path: ["FIREBASE_PROJECT_ID"],
          message: "Firestore mode requires FIREBASE_PROJECT_ID or FIRESTORE_EMULATOR_HOST",
        });
      }
    }
    const maxAge = value.ADMIN_SESSION_MAX_AGE_SECONDS;
    if (maxAge !== undefined && maxAge > 5 * 24 * 60 * 60) {
      ctx.addIssue({
        code: "custom",
        path: ["ADMIN_SESSION_MAX_AGE_SECONDS"],
        message: "Session max age cannot exceed 5 days",
      });
    }
    const googleMode = value.GOOGLE_WORKSPACE_MODE ?? "disabled";
    if (googleMode === "service-account") {
      if (!value.GOOGLE_WORKSPACE_SHARED_DRIVE_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["GOOGLE_WORKSPACE_SHARED_DRIVE_ID"],
          message: "Required when GOOGLE_WORKSPACE_MODE=service-account",
        });
      }
      if (!value.GOOGLE_WORKSPACE_ROOT_FOLDER_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["GOOGLE_WORKSPACE_ROOT_FOLDER_ID"],
          message: "Required when GOOGLE_WORKSPACE_MODE=service-account",
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  adminEmailAllowlist: string[];
  firebasePrivateKeyNormalized?: string;
};

export type AuthMode = z.infer<typeof authModeSchema>;
export type PersistenceMode = z.infer<typeof persistenceModeSchema>;
export type ContentSourceMode = z.infer<typeof contentSourceModeSchema>;
export type GoogleWorkspaceMode = z.infer<typeof googleWorkspaceModeSchema>;
export type AppEnvironment =
  | NonNullable<ServerEnv["APP_ENV"]>
  | ServerEnv["NODE_ENV"];

export type GoogleWorkspaceConfig = {
  mode: "service-account";
  projectId?: string;
  sharedDriveId: string;
  rootFolderId: string;
  allowedFolderIds: string[];
  maxFileSizeBytes: number;
  importPreviewTtlSeconds: number;
  requestTimeoutMs: number;
  maxRetryAttempts: number;
};

let cached: ServerEnv | null = null;
let cachedGoogleAllowedFolderIds: string[] | undefined;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    CONTENT_SOURCE_MODE: process.env.CONTENT_SOURCE_MODE,
    AUTH_MODE: process.env.AUTH_MODE,
    PERSISTENCE_MODE: process.env.PERSISTENCE_MODE,
    SITE_URL: process.env.SITE_URL,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    ADMIN_EMAIL_ALLOWLIST: process.env.ADMIN_EMAIL_ALLOWLIST,
    ADMIN_SESSION_MAX_AGE_SECONDS: process.env.ADMIN_SESSION_MAX_AGE_SECONDS,
    ADMIN_SESSION_COOKIE_NAME: process.env.ADMIN_SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME: process.env.CSRF_COOKIE_NAME,
    GOOGLE_WORKSPACE_MODE: process.env.GOOGLE_WORKSPACE_MODE,
    GOOGLE_WORKSPACE_PROJECT_ID: process.env.GOOGLE_WORKSPACE_PROJECT_ID,
    GOOGLE_WORKSPACE_SHARED_DRIVE_ID: process.env.GOOGLE_WORKSPACE_SHARED_DRIVE_ID,
    GOOGLE_WORKSPACE_ROOT_FOLDER_ID: process.env.GOOGLE_WORKSPACE_ROOT_FOLDER_ID,
    GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS:
      process.env.GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS,
    GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES:
      process.env.GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES,
    GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS:
      process.env.GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS,
    GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS:
      process.env.GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS,
    GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS:
      process.env.GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS,
  });

  if (!parsed.success) {
    throw new Error(
      [
        "Invalid server environment configuration.",
        "Check .env.example and docs/config/ENVIRONMENT.md.",
        formatZodError(parsed.error),
      ].join("\n"),
    );
  }

  let allowlist: string[] = [];
  try {
    allowlist = parseAllowlist(parsed.data.ADMIN_EMAIL_ALLOWLIST);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Invalid ADMIN_EMAIL_ALLOWLIST",
    );
  }

  let googleAllowedFolderIds: string[] = [];
  try {
    googleAllowedFolderIds = parseGoogleFolderIds(
      parsed.data.GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS,
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Invalid GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS",
    );
  }

  cachedGoogleAllowedFolderIds = googleAllowedFolderIds;
  cached = {
    ...parsed.data,
    adminEmailAllowlist: allowlist,
    firebasePrivateKeyNormalized: normalizePrivateKey(
      parsed.data.FIREBASE_PRIVATE_KEY,
    ),
  };
  return cached;
}

export function getAppEnvironment(): AppEnvironment {
  const env = getServerEnv();
  return env.APP_ENV ?? env.NODE_ENV;
}

export function getLogLevel(): z.infer<typeof logLevelSchema> {
  const env = getServerEnv();
  if (env.LOG_LEVEL) return env.LOG_LEVEL;
  return env.NODE_ENV === "production" ? "info" : "debug";
}

export function getAuthMode(): AuthMode {
  return getServerEnv().AUTH_MODE ?? "disabled";
}

export function getPersistenceMode(): PersistenceMode {
  const env = getServerEnv();
  if (env.PERSISTENCE_MODE) return env.PERSISTENCE_MODE;
  if (env.NODE_ENV === "test") return "memory";
  // Prefer firestore when explicitly operating with project/emulator; otherwise
  // composition reports unavailable rather than silently using memory in prod.
  return "firestore";
}

export function getContentSourceMode(): ContentSourceMode {
  const env = getServerEnv();
  if (env.CONTENT_SOURCE_MODE) return env.CONTENT_SOURCE_MODE;
  return env.NODE_ENV === "production" ? "empty" : "demo";
}

export function getSiteUrl(): string | null {
  return getServerEnv().SITE_URL ?? null;
}

/** Default 8 hours; max 5 days enforced by schema. */
export function getAdminSessionMaxAgeSeconds(): number {
  return getServerEnv().ADMIN_SESSION_MAX_AGE_SECONDS ?? 8 * 60 * 60;
}

export function getAdminSessionCookieName(): string {
  const env = getServerEnv();
  if (env.ADMIN_SESSION_COOKIE_NAME) return env.ADMIN_SESSION_COOKIE_NAME;
  return env.NODE_ENV === "production"
    ? "__Host-ckp_admin_session"
    : "ckp_admin_session";
}

export function getCsrfCookieName(): string {
  return getServerEnv().CSRF_COOKIE_NAME ?? "ckp_csrf";
}

export function getAdminEmailAllowlist(): readonly string[] {
  return getServerEnv().adminEmailAllowlist;
}

export function getGoogleWorkspaceMode(): GoogleWorkspaceMode {
  return getServerEnv().GOOGLE_WORKSPACE_MODE ?? "disabled";
}

export function getGoogleWorkspaceConfig(): GoogleWorkspaceConfig {
  const env = getServerEnv();
  const mode = env.GOOGLE_WORKSPACE_MODE ?? "disabled";
  if (mode !== "service-account") {
    throw new Error(
      "Google Workspace config is unavailable when GOOGLE_WORKSPACE_MODE is not service-account",
    );
  }
  if (!env.GOOGLE_WORKSPACE_SHARED_DRIVE_ID || !env.GOOGLE_WORKSPACE_ROOT_FOLDER_ID) {
    throw new Error(
      "Google Workspace service-account mode requires SHARED_DRIVE_ID and ROOT_FOLDER_ID",
    );
  }
  return {
    mode: "service-account",
    projectId: env.GOOGLE_WORKSPACE_PROJECT_ID,
    sharedDriveId: env.GOOGLE_WORKSPACE_SHARED_DRIVE_ID,
    rootFolderId: env.GOOGLE_WORKSPACE_ROOT_FOLDER_ID,
    allowedFolderIds: cachedGoogleAllowedFolderIds ?? [],
    maxFileSizeBytes:
      env.GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES ??
      DEFAULT_GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES,
    importPreviewTtlSeconds:
      env.GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS ??
      DEFAULT_GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS,
    requestTimeoutMs:
      env.GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS ??
      DEFAULT_GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS,
    maxRetryAttempts:
      env.GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS ??
      DEFAULT_GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS,
  };
}

export function resetServerEnvCacheForTests(): void {
  cached = null;
  cachedGoogleAllowedFolderIds = undefined;
}
