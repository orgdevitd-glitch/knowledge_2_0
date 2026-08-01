import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { getAuthMode, getCsrfCookieName } from "@/config/env";
import { verifyCsrfToken, createCsrfToken, csrfCookieOptions } from "@/server/auth/csrf";
import { authSessionLimiter } from "@/server/auth/rate-limit";
import {
  createAdminSessionFromIdToken,
  isAllowedOrigin,
  sessionCookieOptions,
  SessionError,
} from "@/server/auth/session";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idToken: z.string().min(20).max(16_000),
  csrfToken: z.string().min(20).max(1024),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
  }

  if (getAuthMode() !== "firebase") {
    return NextResponse.json(
      { error: "Authentication is unavailable" },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = authSessionLimiter.take(`session:${ip}`);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 20_000) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    raw = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const jar = await cookies();
  const csrfCookie = jar.get(getCsrfCookieName())?.value;
  if (!verifyCsrfToken(csrfCookie, parsed.data.csrfToken)) {
    logger.warn("invalid csrf on session create");
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  }

  try {
    const { cookieValue } = await createAdminSessionFromIdToken({
      idToken: parsed.data.idToken,
    });
    const sessionOpts = sessionCookieOptions(
      process.env.NODE_ENV === "production",
    );
    jar.set(sessionOpts.name, cookieValue, sessionOpts);

    // Rotate CSRF after login
    const nextCsrf = createCsrfToken();
    const csrfOpts = csrfCookieOptions(process.env.NODE_ENV === "production");
    jar.set(csrfOpts.name, nextCsrf.token, csrfOpts);

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SessionError) {
      const status =
        error.code === "ACCESS_DENIED" || error.code === "STALE_AUTH"
          ? 403
          : 401;
      return NextResponse.json({ error: "Access denied" }, { status });
    }
    logger.error("session create failed");
    return NextResponse.json({ error: "Access denied" }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let csrfToken: string | undefined;
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { csrfToken?: string };
      csrfToken = body.csrfToken;
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  } else {
    csrfToken = request.headers.get("x-csrf-token") ?? undefined;
  }

  const jar = await cookies();
  const csrfCookie = jar.get(getCsrfCookieName())?.value;
  if (!verifyCsrfToken(csrfCookie, csrfToken)) {
    logger.warn("invalid csrf on logout");
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  }

  const sessionOpts = sessionCookieOptions(
    process.env.NODE_ENV === "production",
  );
  jar.set(sessionOpts.name, "", { ...sessionOpts, maxAge: 0 });
  logger.info("admin logout");

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
