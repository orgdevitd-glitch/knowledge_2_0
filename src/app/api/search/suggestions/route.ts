import { NextResponse } from "next/server";
import { z } from "zod";

import { publicSearchSuggestionsLimiter } from "@/server/auth/rate-limit";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { executeSearchSuggestions } from "@/features/search/application/suggestions-service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(SEARCH_LIMIT_DEFAULTS.queryMaxLength).optional().default(""),
  type: z.enum(["article", "prompt"]).optional().nullable(),
  category: z.string().max(128).optional().nullable(),
  tag: z.string().max(128).optional().nullable(),
  audience: z.string().max(128).optional().nullable(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(SEARCH_LIMIT_DEFAULTS.suggestionsMaxItems)
    .optional()
    .nullable(),
});

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

const noStore = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
} as const;

export async function GET(request: Request) {
  const limited = publicSearchSuggestionsLimiter.take(
    `search-suggest:${clientIp(request)}`,
  );
  if (!limited.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many suggestion requests",
          fields: {},
        },
      },
      {
        status: 429,
        headers: {
          ...noStore,
          ...(limited.retryAfterSeconds
            ? { "Retry-After": String(limited.retryAfterSeconds) }
            : {}),
        },
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
      limit: url.searchParams.get("limit"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid suggestion parameters",
            fields: {},
          },
        },
        { status: 400, headers: noStore },
      );
    }

    const result = await executeSearchSuggestions({
      q: parsed.data.q,
      type: parsed.data.type,
      category: parsed.data.category,
      tag: parsed.data.tag,
      audience: parsed.data.audience,
      limit: parsed.data.limit,
    });

    return NextResponse.json(result, { headers: noStore });
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        items: [],
        incomplete: true,
        error: {
          code: "SEARCH_UNAVAILABLE",
          message: "Suggestions temporarily unavailable",
        },
      },
      { status: 503, headers: noStore },
    );
  }
}
