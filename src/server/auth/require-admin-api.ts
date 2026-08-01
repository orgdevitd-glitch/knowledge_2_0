import "server-only";

import { NextResponse } from "next/server";

import { getAuthMode } from "@/config/env";
import { logger } from "@/lib/logger";
import { getOptionalAdminPrincipal } from "@/server/auth/guard";
import type { AdminPrincipal } from "@/server/auth/principal";

export class AdminApiAuthError extends Error {
  constructor(
    readonly httpStatus: 401 | 403 | 503,
    readonly code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "AUTH_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "AdminApiAuthError";
  }
}

/**
 * API guard: returns principal or throws AdminApiAuthError (JSON handlers).
 * Does not redirect — unlike requireAdminPrincipal for pages.
 */
export async function requireAdminPrincipalForApi(): Promise<AdminPrincipal> {
  if (getAuthMode() !== "firebase") {
    throw new AdminApiAuthError(
      503,
      "AUTH_UNAVAILABLE",
      "Authentication is unavailable",
    );
  }
  const principal = await getOptionalAdminPrincipal();
  if (!principal) {
    logger.warn("admin API without session");
    throw new AdminApiAuthError(401, "AUTH_REQUIRED", "Authentication required");
  }
  if (principal.role !== "admin") {
    throw new AdminApiAuthError(403, "ACCESS_DENIED", "Access denied");
  }
  return principal;
}

export function adminAuthErrorResponse(error: AdminApiAuthError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code:
          error.code === "AUTH_UNAVAILABLE" ? "ACCESS_DENIED" : error.code,
        message: error.message,
        fields: {},
      },
    },
    {
      status: error.httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
