import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthMode, getAdminSessionCookieName } from "@/config/env";
import { logger } from "@/lib/logger";
import {
  sessionCookieOptions,
  verifyAdminSessionCookie,
} from "./session";
import type { AdminPrincipal } from "./principal";

export async function getOptionalAdminPrincipal(): Promise<AdminPrincipal | null> {
  if (getAuthMode() !== "firebase") return null;
  const jar = await cookies();
  const value = jar.get(getAdminSessionCookieName())?.value;
  return verifyAdminSessionCookie({ cookieValue: value });
}

/**
 * Server-side admin guard. Not a middleware-only boundary.
 */
export async function requireAdminPrincipal(): Promise<AdminPrincipal> {
  if (getAuthMode() !== "firebase") {
    redirect("/admin/sign-in?reason=disabled");
  }
  const principal = await getOptionalAdminPrincipal();
  if (!principal) {
    logger.warn("protected admin route without session");
    redirect("/admin/sign-in?reason=unauthenticated");
  }
  return principal;
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  const opts = sessionCookieOptions(process.env.NODE_ENV === "production");
  jar.set(opts.name, "", { ...opts, maxAge: 0 });
}
