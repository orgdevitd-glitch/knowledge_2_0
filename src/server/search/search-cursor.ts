import { createHmac, createHash } from "node:crypto";

import { getSearchLimits } from "@/config/search-env";
import { ValidationError } from "@/domain/shared/errors";
import type { SearchEntityType } from "@/domain/search/search-limits";
import type { SearchQueryFilters } from "@/server/repositories/interfaces/search-index-port";
import { normalizeSearchQuery } from "@/domain/search/text-normalize";

export const SEARCH_CURSOR_SCHEMA_VERSION = 1 as const;

export type SearchCursorPayload = {
  schemaVersion: typeof SEARCH_CURSOR_SCHEMA_VERSION;
  generationId: string;
  queryHash: string;
  filtersHash: string;
  score: number;
  publishedAt: string;
  entityType: SearchEntityType;
  entityId: string;
};

function signingKey(): string {
  return getSearchLimits().cursorHmacSecret;
}

export function hashSearchQuery(q: string): string {
  return createHash("sha256")
    .update(normalizeSearchQuery(q))
    .digest("hex")
    .slice(0, 24);
}

/** Canonical filter hash — independent of URL parameter order. */
export function hashSearchFilters(filters: SearchQueryFilters): string {
  const stable = JSON.stringify({
    type: filters.entityType ?? null,
    category: filters.categoryId ?? null,
    tag: filters.tagId ?? null,
    audience: filters.audienceId ?? null,
  });
  return createHash("sha256").update(stable).digest("hex").slice(0, 24);
}

export function encodeSearchCursor(payload: SearchCursorPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url")
    .slice(0, 32);
  return `${body}.${sig}`;
}

export function decodeSearchCursor(cursor: string): SearchCursorPayload {
  try {
    const [body, sig] = cursor.split(".");
    if (!body || !sig) throw new Error("shape");
    const expected = createHmac("sha256", signingKey())
      .update(body)
      .digest("base64url")
      .slice(0, 32);
    if (sig !== expected) throw new Error("sig");
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SearchCursorPayload;
    if (
      parsed.schemaVersion !== SEARCH_CURSOR_SCHEMA_VERSION ||
      typeof parsed.generationId !== "string" ||
      typeof parsed.queryHash !== "string" ||
      typeof parsed.filtersHash !== "string" ||
      typeof parsed.score !== "number" ||
      typeof parsed.publishedAt !== "string" ||
      typeof parsed.entityType !== "string" ||
      typeof parsed.entityId !== "string"
    ) {
      throw new Error("fields");
    }
    return parsed;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Malformed search cursor", {
      adminCode: "SEARCH_CURSOR_INVALID",
    });
  }
}
