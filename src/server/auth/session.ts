import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";

import {
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
  getAuthMode,
  getServerEnv,
} from "@/config/env";
import { getFirebaseAdminAuth } from "@/server/firebase/admin";
import {
  defaultAdminAccessPolicy,
  logAccessDenied,
  type AdminAccessPolicy,
} from "./access-policy";
import type { AdminPrincipal } from "./principal";
import { logger } from "@/lib/logger";

/** Max age of auth_time for fresh sign-in when creating session (5 minutes). */
export const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

export type FirebaseAuthPort = {
  verifyIdToken(idToken: string): Promise<DecodedIdToken>;
  createSessionCookie(
    idToken: string,
    expiresInMs: number,
  ): Promise<string>;
  verifySessionCookie(
    sessionCookie: string,
    checkRevoked?: boolean,
  ): Promise<DecodedIdToken>;
};

export function createFirebaseAuthPort(): FirebaseAuthPort {
  const auth = getFirebaseAdminAuth();
  return {
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken, true),
    createSessionCookie: (idToken, expiresInMs) =>
      auth.createSessionCookie(idToken, { expiresIn: expiresInMs }),
    verifySessionCookie: (cookie, checkRevoked = true) =>
      auth.verifySessionCookie(cookie, checkRevoked),
  };
}

export function sessionCookieOptions(isProduction: boolean) {
  const maxAge = getAdminSessionMaxAgeSeconds();
  return {
    name: getAdminSessionCookieName(),
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createAdminSessionFromIdToken(input: {
  idToken: string;
  nowSeconds?: number;
  authPort?: FirebaseAuthPort;
  accessPolicy?: AdminAccessPolicy;
}): Promise<{ cookieValue: string; principal: AdminPrincipal }> {
  if (getAuthMode() !== "firebase") {
    throw new SessionError("AUTH_DISABLED", "Authentication is disabled");
  }

  const authPort = input.authPort ?? createFirebaseAuthPort();
  const policy = input.accessPolicy ?? defaultAdminAccessPolicy;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  let decoded: DecodedIdToken;
  try {
    decoded = await authPort.verifyIdToken(input.idToken);
  } catch {
    logAccessDenied("invalid_token");
    throw new SessionError("INVALID_TOKEN", "Invalid credentials");
  }

  const authTime = decoded.auth_time ?? 0;
  if (nowSeconds - authTime > RECENT_AUTH_MAX_AGE_SECONDS) {
    logAccessDenied("stale_auth");
    throw new SessionError("STALE_AUTH", "Recent authentication required");
  }

  const email = decoded.email ?? null;
  const emailVerified = Boolean(decoded.email_verified);
  if (!policy.isAllowed({ email, emailVerified })) {
    logAccessDenied("allowlist_or_unverified", {
      emailHash: email ? hashEmail(email) : null,
    });
    throw new SessionError("ACCESS_DENIED", "Access denied");
  }

  const expiresInMs = getAdminSessionMaxAgeSeconds() * 1000;
  const cookieValue = await authPort.createSessionCookie(
    input.idToken,
    expiresInMs,
  );

  const principal: AdminPrincipal = {
    uid: decoded.uid,
    email: email!.trim().toLowerCase(),
    displayName: decoded.name ?? null,
    role: "admin",
    sessionIssuedAt: new Date(nowSeconds * 1000).toISOString(),
  };

  logger.info("admin login success", { emailHash: hashEmail(principal.email) });
  return { cookieValue, principal };
}

export async function verifyAdminSessionCookie(input: {
  cookieValue: string | undefined;
  authPort?: FirebaseAuthPort;
  accessPolicy?: AdminAccessPolicy;
}): Promise<AdminPrincipal | null> {
  if (getAuthMode() !== "firebase") return null;
  if (!input.cookieValue) return null;

  const authPort = input.authPort ?? createFirebaseAuthPort();
  const policy = input.accessPolicy ?? defaultAdminAccessPolicy;

  let decoded: DecodedIdToken;
  try {
    decoded = await authPort.verifySessionCookie(input.cookieValue, true);
  } catch {
    return null;
  }

  const email = decoded.email ?? null;
  const emailVerified = Boolean(decoded.email_verified);
  if (!policy.isAllowed({ email, emailVerified })) {
    logAccessDenied("allowlist_revoked_mid_session", {
      emailHash: email ? hashEmail(email) : null,
    });
    return null;
  }

  return {
    uid: decoded.uid,
    email: email!.trim().toLowerCase(),
    displayName: decoded.name ?? null,
    role: "admin",
    sessionIssuedAt: new Date((decoded.iat ?? 0) * 1000).toISOString(),
  };
}

export class SessionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

function hashEmail(email: string): string {
  // Stable non-reversible-ish marker for logs (not a security hash of secrets).
  let h = 0;
  for (let i = 0; i < email.length; i += 1) {
    h = (h * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `e${h.toString(16)}`;
}

export function getAllowedOrigins(): string[] {
  const env = getServerEnv();
  const origins = new Set<string>();
  if (env.SITE_URL) origins.add(env.SITE_URL.replace(/\/$/, ""));
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  return [...origins];
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin.replace(/\/$/, ""));
}
