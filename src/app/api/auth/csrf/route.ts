import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthMode } from "@/config/env";
import {
  createCsrfToken,
  csrfCookieOptions,
} from "@/server/auth/csrf";
import { authCsrfLimiter } from "@/server/auth/rate-limit";
import { isAllowedOrigin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = authCsrfLimiter.take(`csrf:${ip}`);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  if (getAuthMode() === "disabled") {
    return NextResponse.json(
      { error: "Authentication is unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const payload = createCsrfToken();
  const opts = csrfCookieOptions(process.env.NODE_ENV === "production");
  const jar = await cookies();
  jar.set(opts.name, payload.token, opts);

  return NextResponse.json(
    { csrfToken: payload.token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
