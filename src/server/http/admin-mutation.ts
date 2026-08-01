import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import type { z } from "zod";

import { getCsrfCookieName } from "@/config/env";
import { verifyCsrfToken } from "@/server/auth/csrf";
import {
  adminAuthErrorResponse,
  requireAdminPrincipalForApi,
  AdminApiAuthError,
} from "@/server/auth/require-admin-api";
import type { AdminPrincipal } from "@/server/auth/principal";
import { isAllowedOrigin } from "@/server/auth/session";
import type { RateLimiter } from "@/server/auth/rate-limit";
import { InProcessRateLimiter } from "@/server/auth/rate-limit";
import {
  ConflictError,
  DomainError,
  DuplicateSlugError,
  DuplicateTitleError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from "@/domain/shared/errors";
import { logger } from "@/lib/logger";
import {
  GoogleWorkspaceError,
  isGoogleWorkspaceError,
} from "@/server/google-workspace/errors";

export type AdminErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATUS_TRANSITION"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_TITLE"
  | "CATEGORY_CYCLE"
  | "CATEGORY_DEPTH_EXCEEDED"
  | "CATEGORY_PARENT_ARCHIVED"
  | "CATEGORY_HAS_ACTIVE_CHILDREN"
  | "TAXONOMY_TREE_LIMIT_EXCEEDED"
  | "INVALID_PARENT"
  | "INVALID_SORT_ORDER"
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "CSRF_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "PERSISTENCE_UNAVAILABLE"
  | GoogleWorkspaceError["code"];

export type AdminErrorBody = {
  error: {
    code: AdminErrorCode;
    message: string;
    fields: Record<string, string>;
  };
};

const SAFE_FIELD_NAMES = new Set([
  "title",
  "slug",
  "summary",
  "description",
  "parentId",
  "sortOrder",
  "reviewDueAt",
  "changeSummary",
  "expectedRevision",
  "blocks",
  "categoryIds",
  "tagIds",
  "audienceIds",
  "direction",
  "position",
]);

const TAXONOMY_ADMIN_CODES = new Set<AdminErrorCode>([
  "CATEGORY_CYCLE",
  "CATEGORY_DEPTH_EXCEEDED",
  "CATEGORY_PARENT_ARCHIVED",
  "CATEGORY_HAS_ACTIVE_CHILDREN",
  "TAXONOMY_TREE_LIMIT_EXCEEDED",
  "INVALID_PARENT",
  "INVALID_SORT_ORDER",
  "DUPLICATE_TITLE",
  "INVALID_STATUS_TRANSITION",
  "VALIDATION_ERROR",
]);

export const adminCreateLimiter = new InProcessRateLimiter(20, 60_000);
export const adminSaveLimiter = new InProcessRateLimiter(120, 60_000);
export const adminPublishLimiter = new InProcessRateLimiter(20, 60_000);
export const adminRestoreLimiter = new InProcessRateLimiter(20, 60_000);
export const taxonomyCreateLimiter = new InProcessRateLimiter(30, 60_000);
export const taxonomyUpdateLimiter = new InProcessRateLimiter(60, 60_000);
export const taxonomyMoveLimiter = new InProcessRateLimiter(30, 60_000);
export const taxonomyReorderLimiter = new InProcessRateLimiter(30, 60_000);
export const taxonomyArchiveLimiter = new InProcessRateLimiter(30, 60_000);
export const taxonomyRestoreLimiter = new InProcessRateLimiter(30, 60_000);
export const taxonomyUsageLimiter = new InProcessRateLimiter(60, 60_000);
export const googleDriveBrowseLimiter = new InProcessRateLimiter(60, 60_000);
export const googleSourceTestLimiter = new InProcessRateLimiter(20, 60_000);
export const googlePreviewLimiter = new InProcessRateLimiter(10, 60_000);
export const googleConfirmLimiter = new InProcessRateLimiter(10, 60_000);

const GOOGLE_USER_MESSAGES: Record<GoogleWorkspaceError["code"], string> = {
  GOOGLE_WORKSPACE_DISABLED: "Интеграция Google Workspace отключена.",
  GOOGLE_AUTHENTICATION_FAILED: "Не удалось аутентифицировать сервис Google.",
  GOOGLE_ACCESS_DENIED: "Нет доступа к выбранному файлу Google.",
  GOOGLE_FILE_NOT_FOUND: "Файл Google не найден.",
  GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT:
    "Файл находится вне разрешённой корневой папки.",
  GOOGLE_SHARED_DRIVE_MISMATCH: "Файл не принадлежит настроенному Shared Drive.",
  GOOGLE_UNSUPPORTED_FILE_TYPE: "Тип файла Google не поддерживается.",
  GOOGLE_API_RATE_LIMITED: "Превышен лимит запросов к Google API.",
  GOOGLE_API_TIMEOUT: "Превышено время ожидания ответа Google API.",
  GOOGLE_API_UNAVAILABLE: "Google API временно недоступен.",
  GOOGLE_DOCUMENT_INVALID: "Документ Google имеет некорректную структуру.",
  GOOGLE_SHEET_SCHEMA_INVALID: "Схема таблицы Google некорректна.",
  IMPORT_PREVIEW_EXPIRED: "Срок действия предварительного просмотра истёк.",
  IMPORT_ALREADY_CONFIRMED: "Импорт уже подтверждён.",
  IMPORT_CONFLICT: "Конфликт импорта.",
  IMPORT_VALIDATION_FAILED: "Импорт не прошёл проверку.",
  IMPORT_SOURCE_CHANGED:
    "Источник Google изменился после preview. Создайте новый preview.",
  IMPORT_TARGET_CHANGED:
    "Целевой материал изменился после preview. Создайте новый preview.",
};

function mapGoogleWorkspaceErrorToResponse(
  error: GoogleWorkspaceError,
): NextResponse {
  const status =
    error.code === "GOOGLE_WORKSPACE_DISABLED"
      ? 503
      : error.code === "GOOGLE_API_RATE_LIMITED"
        ? 429
        : error.code === "GOOGLE_FILE_NOT_FOUND"
          ? 404
          : error.code === "IMPORT_ALREADY_CONFIRMED" ||
              error.code === "IMPORT_SOURCE_CHANGED" ||
              error.code === "IMPORT_TARGET_CHANGED" ||
              error.code === "IMPORT_CONFLICT" ||
              error.code === "IMPORT_PREVIEW_EXPIRED"
            ? 409
            : error.code === "GOOGLE_ACCESS_DENIED" ||
                error.code === "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT" ||
                error.code === "GOOGLE_SHARED_DRIVE_MISMATCH"
              ? 403
              : 400;
  return adminErrorResponse(
    error.code,
    GOOGLE_USER_MESSAGES[error.code] ?? "Ошибка интеграции Google Workspace.",
    status,
  );
}

export function adminErrorResponse(
  code: AdminErrorCode,
  message: string,
  status: number,
  fields: Record<string, string> = {},
): NextResponse {
  const body: AdminErrorBody = {
    error: { code, message, fields },
  };
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function mapDomainErrorToResponse(error: unknown): NextResponse {
  if (error instanceof AdminApiAuthError) {
    return adminAuthErrorResponse(error);
  }
  if (isGoogleWorkspaceError(error)) {
    return mapGoogleWorkspaceErrorToResponse(error);
  }
  if (error instanceof ValidationError) {
    const fields: Record<string, string> = {};
    const issues = error.details.issues;
    if (Array.isArray(issues)) {
      for (const issue of issues) {
        if (typeof issue === "string") {
          const key = issue.split(":")[0]?.trim() ?? "form";
          if (SAFE_FIELD_NAMES.has(key) || key === "form") {
            fields[key === "form" ? "form" : key] = issue;
          }
        }
      }
    }
    const adminCode = error.details.adminCode;
    const code =
      typeof adminCode === "string" &&
      TAXONOMY_ADMIN_CODES.has(adminCode as AdminErrorCode)
        ? (adminCode as AdminErrorCode)
        : "VALIDATION_ERROR";
    const status =
      code === "INVALID_STATUS_TRANSITION" ||
      code === "CATEGORY_CYCLE" ||
      code === "CATEGORY_DEPTH_EXCEEDED" ||
      code === "CATEGORY_PARENT_ARCHIVED"
        ? 409
        : 400;
    return adminErrorResponse(
      code,
      code === "VALIDATION_ERROR"
        ? "Проверьте заполнение формы."
        : error.message,
      status,
      fields,
    );
  }
  if (error instanceof NotFoundError) {
    return adminErrorResponse("NOT_FOUND", "Объект не найден.", 404);
  }
  if (error instanceof ConflictError) {
    return adminErrorResponse(
      "CONFLICT",
      "Объект был изменен в другой сессии.",
      409,
    );
  }
  if (error instanceof DuplicateSlugError) {
    return adminErrorResponse(
      "DUPLICATE_SLUG",
      "Такой адрес (slug) уже используется.",
      409,
      { slug: "duplicate" },
    );
  }
  if (error instanceof DuplicateTitleError) {
    return adminErrorResponse(
      "DUPLICATE_TITLE",
      "Такое название уже используется.",
      409,
      { title: "duplicate" },
    );
  }
  if (error instanceof InvalidStatusTransitionError) {
    return adminErrorResponse(
      "INVALID_STATUS_TRANSITION",
      "Это действие недоступно для текущего статуса.",
      409,
    );
  }
  if (error instanceof DomainError && error.code === "REPOSITORY") {
    return adminErrorResponse(
      "PERSISTENCE_UNAVAILABLE",
      "Хранилище временно недоступно.",
      503,
    );
  }
  logger.error("admin mutation internal error", {
    name: error instanceof Error ? error.name : "unknown",
  });
  return adminErrorResponse(
    "INTERNAL_ERROR",
    "Не удалось выполнить операцию.",
    500,
  );
}

export type AdminMutationContext = {
  principal: AdminPrincipal;
  requestId: string;
  body: unknown;
};

type RunAdminMutationOptions<TSchema extends z.ZodType> = {
  request: Request;
  limiter: RateLimiter;
  schema: TSchema;
  maxBodyBytes?: number;
  handler: (
    ctx: AdminMutationContext & { data: z.infer<TSchema> },
  ) => Promise<NextResponse>;
};

/**
 * Shared pipeline for admin JSON mutations.
 */
export async function runAdminMutation<TSchema extends z.ZodType>(
  options: RunAdminMutationOptions<TSchema>,
): Promise<NextResponse> {
  const { request, limiter, schema, handler } = options;
  const maxBodyBytes = options.maxBodyBytes ?? 512_000;

  try {
    const origin = request.headers.get("origin");
    if (!isAllowedOrigin(origin)) {
      return adminErrorResponse("ACCESS_DENIED", "Forbidden", 403);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return adminErrorResponse(
        "VALIDATION_ERROR",
        "Unsupported media type",
        415,
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limited = limiter.take(`admin:${ip}`);
    if (!limited.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED" as const,
            message: "Слишком много запросов. Попробуйте позже.",
            fields: {},
          },
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limited.retryAfterSeconds ?? 60),
          },
        },
      );
    }

    const text = await request.text();
    if (text.length > maxBodyBytes) {
      return adminErrorResponse(
        "VALIDATION_ERROR",
        "Payload too large",
        413,
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      return adminErrorResponse("VALIDATION_ERROR", "Invalid JSON", 400);
    }

    const jar = await cookies();
    const csrfCookie = jar.get(getCsrfCookieName())?.value;
    const csrfToken =
      raw &&
      typeof raw === "object" &&
      "csrfToken" in raw &&
      typeof (raw as { csrfToken: unknown }).csrfToken === "string"
        ? (raw as { csrfToken: string }).csrfToken
        : request.headers.get("x-csrf-token") ?? undefined;

    if (!verifyCsrfToken(csrfCookie, csrfToken)) {
      logger.warn("invalid csrf on admin mutation");
      return adminErrorResponse(
        "CSRF_INVALID",
        "Invalid request",
        403,
      );
    }

    const principal = await requireAdminPrincipalForApi();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (SAFE_FIELD_NAMES.has(key) || key === "form" || key === "csrfToken") {
          if (key !== "csrfToken") {
            fields[key] = issue.message;
          }
        }
      }
      return adminErrorResponse(
        "VALIDATION_ERROR",
        "Проверьте заполнение формы.",
        400,
        fields,
      );
    }

    return await handler({
      principal,
      requestId: randomUUID(),
      body: raw,
      data: parsed.data,
    });
  } catch (error) {
    return mapDomainErrorToResponse(error);
  }
}

export function okJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
