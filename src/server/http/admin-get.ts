import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  adminAuthErrorResponse,
  requireAdminPrincipalForApi,
  AdminApiAuthError,
} from "@/server/auth/require-admin-api";
import type { AdminPrincipal } from "@/server/auth/principal";
import { InProcessRateLimiter } from "@/server/auth/rate-limit";
import {
  mapDomainErrorToResponse,
  okJson,
} from "@/server/http/admin-mutation";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";

export async function runAdminGet(options: {
  limiter?: InProcessRateLimiter;
  handler: (ctx: {
    principal: AdminPrincipal;
    requestId: string;
  }) => Promise<NextResponse>;
}): Promise<NextResponse> {
  try {
    const principal = await requireAdminPrincipalForApi();
    if (options.limiter) {
      const limited = options.limiter.take(`admin:${principal.uid}`);
      if (!limited.allowed) {
        return NextResponse.json(
          {
            error: {
              code: "RATE_LIMITED",
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
    }
    return await options.handler({
      principal,
      requestId: randomUUID(),
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return adminAuthErrorResponse(error);
    }
    return mapDomainErrorToResponse(error);
  }
}

export function googleDisabledJson(): NextResponse {
  return okJson({
    mode: "disabled",
    available: false,
    message: "Интеграция Google Workspace отключена.",
  });
}

export function assertGoogleEnabled(): void {
  if (!isGoogleWorkspaceEnabled()) {
    throw new GoogleWorkspaceError(
      "GOOGLE_WORKSPACE_DISABLED",
      "Google Workspace integration is disabled",
    );
  }
}
