import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { getAssistantConfig } from "@/config/assistant-env";
import { askAssistant } from "@/features/assistant/application/ask-assistant";
import { publicMessageForStatus } from "@/domain/assistant/refusal-messages";
import { isAllowedOrigin } from "@/server/auth/session";
import { assistantRateLimitKeyFromRequest } from "@/server/assistant/client-identity";
import {
  getAssistantProviderPort,
  getAssistantRateLimitPort,
  getAssistantRetrievalPort,
} from "@/server/composition/assistant-ports";
import { readBoundedJsonBody } from "@/server/http/read-bounded-json-body";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    question: z.string(),
    filters: z
      .object({
        type: z.enum(["article", "prompt", "all"]).optional(),
        category: z.string().max(128).optional().nullable(),
        tag: z.string().max(128).optional().nullable(),
        audience: z.string().max(128).optional().nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();

const FORBIDDEN_CLIENT_FIELDS = [
  "systemPrompt",
  "evidence",
  "sourceUrls",
  "model",
  "provider",
  "tools",
  "temperature",
  "maxTokens",
  "messages",
  "conversation",
  "history",
] as const;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  headers.set("Vary", "Origin");
  // Explicitly no CORS open: never set Access-Control-Allow-Origin.
  headers.delete("Access-Control-Allow-Origin");
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const base = value.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base !== "application/json") return false;
  const charset = /charset\s*=\s*([^\s;]+)/i.exec(value);
  if (charset) {
    const cs = charset[1]!.replace(/['"]/g, "").toLowerCase();
    if (cs !== "utf-8" && cs !== "utf8") return false;
  }
  return true;
}

function isSecFetchSiteAllowed(value: string | null): boolean {
  if (value == null || value === "") return true;
  return value === "same-origin" || value === "same-site" || value === "none";
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // Browser POST contract: Origin required; null / missing / mismatch → 403.
  // X-Forwarded-Host is never used as a trusted origin.
  if (!isAllowedOrigin(origin)) {
    return noStoreJson(
      {
        status: "validation_error",
        message: publicMessageForStatus("validation_error"),
      },
      { status: 403 },
    );
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (!isSecFetchSiteAllowed(secFetchSite)) {
    return noStoreJson(
      {
        status: "validation_error",
        message: publicMessageForStatus("validation_error"),
      },
      { status: 403 },
    );
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return noStoreJson(
      {
        status: "validation_error",
        message: publicMessageForStatus("validation_error"),
      },
      { status: 415 },
    );
  }

  let cfg;
  try {
    cfg = getAssistantConfig();
  } catch {
    return noStoreJson(
      {
        status: "temporarily_unavailable",
        message: publicMessageForStatus("temporarily_unavailable"),
      },
      { status: 503 },
    );
  }

  const parsedBody = await readBoundedJsonBody(
    request,
    cfg.requestBodyMaxBytes,
  );
  if (!parsedBody.ok) {
    const status =
      parsedBody.reason === "too_large"
        ? 413
        : parsedBody.reason === "invalid_content_length"
          ? 400
          : 400;
    return noStoreJson(
      {
        status: "validation_error",
        message: publicMessageForStatus("validation_error"),
      },
      { status },
    );
  }

  if (
    parsedBody.value &&
    typeof parsedBody.value === "object" &&
    !Array.isArray(parsedBody.value)
  ) {
    const keys = Object.keys(parsedBody.value as object);
    for (const forbidden of FORBIDDEN_CLIENT_FIELDS) {
      if (keys.includes(forbidden)) {
        return noStoreJson(
          {
            status: "validation_error",
            message: publicMessageForStatus("validation_error"),
          },
          { status: 400 },
        );
      }
    }
  }

  const parsed = bodySchema.safeParse(parsedBody.value);
  if (!parsed.success) {
    // Do not echo Zod issues (may contain user input).
    return noStoreJson(
      {
        status: "validation_error",
        message: publicMessageForStatus("validation_error"),
      },
      { status: 400 },
    );
  }

  const result = await askAssistant(
    {
      question: parsed.data.question,
      filters: parsed.data.filters,
      requestId: randomUUID(),
      rateLimitKey: assistantRateLimitKeyFromRequest(request),
      signal: request.signal,
    },
    {
      retrieval: getAssistantRetrievalPort(),
      provider: getAssistantProviderPort(),
      rateLimit: getAssistantRateLimitPort(),
    },
  );

  return noStoreJson(result.body, {
    status: result.httpStatus,
    headers: result.retryAfterSeconds
      ? { "Retry-After": String(result.retryAfterSeconds) }
      : undefined,
  });
}

/** Preflight must not open the endpoint (no permissive CORS). */
export async function OPTIONS() {
  return noStoreJson(
    {
      status: "validation_error",
      message: publicMessageForStatus("validation_error"),
    },
    { status: 405 },
  );
}

export async function GET() {
  return noStoreJson(
    {
      status: "validation_error",
      message: publicMessageForStatus("validation_error"),
    },
    { status: 405 },
  );
}
