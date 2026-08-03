import { NextResponse } from "next/server";
import { z } from "zod";

import { publicSearchLimiter } from "@/server/auth/rate-limit";
import { executePublicSearch } from "@/features/search/application/search-query-service";
import { ValidationError } from "@/domain/shared/errors";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(500).optional().default(""),
  type: z.enum(["article", "prompt"]).optional().nullable(),
  category: z.string().max(128).optional().nullable(),
  tag: z.string().max(128).optional().nullable(),
  audience: z.string().max(128).optional().nullable(),
  cursor: z.string().max(2000).optional().nullable(),
  limit: z.coerce.number().int().positive().max(100).optional().nullable(),
});

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: Request) {
  const limited = publicSearchLimiter.take(`search:${clientIp(request)}`);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many search requests",
          fields: {},
        },
      },
      {
        status: 429,
        headers: limited.retryAfterSeconds
          ? { "Retry-After": String(limited.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: url.searchParams.get("q") ?? "",
      type: url.searchParams.get("type"),
      category: url.searchParams.get("category"),
      tag: url.searchParams.get("tag"),
      audience: url.searchParams.get("audience"),
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid search parameters",
            fields: {},
          },
        },
        { status: 400 },
      );
    }

    const result = await executePublicSearch({
      q: parsed.data.q,
      type: parsed.data.type,
      category: parsed.data.category,
      tag: parsed.data.tag,
      audience: parsed.data.audience,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      const code = String(error.details?.adminCode ?? "VALIDATION_ERROR");
      const status =
        code === "SEARCH_CURSOR_EXPIRED" || code === "SEARCH_CURSOR_INVALID"
          ? 409
          : 400;
      return NextResponse.json(
        {
          error: {
            code,
            message: error.message,
            fields: {},
          },
        },
        {
          status,
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "SEARCH_UNAVAILABLE",
          message: "Search temporarily unavailable",
          fields: {},
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
