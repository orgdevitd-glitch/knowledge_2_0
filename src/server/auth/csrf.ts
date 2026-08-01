import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getCsrfCookieName, getServerEnv } from "@/config/env";

const CSRF_TTL_MS = 2 * 60 * 60 * 1000;

export type CsrfPayload = {
  token: string;
  expiresAt: number;
};

function getCsrfSecret(): string {
  const env = getServerEnv();
  // Derive from project id + allowlist length — not ideal; prefer dedicated secret later.
  // Phase 5A: use FIREBASE_PRIVATE_KEY fingerprint or SITE_URL + project as material.
  return [
    env.FIREBASE_PROJECT_ID ?? "local",
    env.SITE_URL ?? "http://localhost:3000",
    "ckp-csrf-v1",
  ].join("|");
}

export function createCsrfToken(now = Date.now()): CsrfPayload {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + CSRF_TTL_MS;
  const signature = signCsrf(token, expiresAt);
  return { token: `${token}.${expiresAt}.${signature}`, expiresAt };
}

function signCsrf(token: string, expiresAt: number): string {
  return createHmac("sha256", getCsrfSecret())
    .update(`${token}:${expiresAt}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyCsrfToken(
  cookieValue: string | undefined,
  submitted: string | undefined,
  now = Date.now(),
): boolean {
  if (!cookieValue || !submitted) return false;
  if (!safeEqual(cookieValue, submitted)) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [token, expiresRaw, signature] = parts;
  if (!token || !expiresRaw || !signature) return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = signCsrf(token, expiresAt);
  return safeEqual(signature, expected);
}

export function csrfCookieOptions(isProduction: boolean) {
  return {
    name: getCsrfCookieName(),
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(CSRF_TTL_MS / 1000),
  };
}
