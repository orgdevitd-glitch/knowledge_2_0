import { z } from "zod";

import { assertSafeAssistantSearchHref } from "@/domain/assistant/search-fallback";
import { isSafePublicSearchHref } from "@/domain/search/search-href";
import { CONTENT_LIMITS } from "@/domain/shared/limits";

/**
 * Display bounds: at least as wide as server env maxima (defense-in-depth).
 * Keep this module free of server config and policy text.
 */
export const ASSISTANT_CLIENT_DTO_BOUNDS = {
  maxBlocks: 20,
  maxBlockCharacters: 20_000,
  maxCitationNumbersPerBlock: 8,
  maxCitations: 20,
  maxTitleCharacters: CONTENT_LIMITS.title.max,
  maxExcerptCharacters: 400,
  maxMessageCharacters: 500,
} as const;

const citationSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string().min(1).max(ASSISTANT_CLIENT_DTO_BOUNDS.maxTitleCharacters),
    href: z.string().min(1),
    entityType: z.enum(["article", "prompt"]),
    excerpt: z
      .string()
      .max(ASSISTANT_CLIENT_DTO_BOUNDS.maxExcerptCharacters)
      .optional(),
  })
  .strict();

const answeredSchema = z
  .object({
    status: z.literal("answered"),
    blocks: z
      .array(
        z
          .object({
            text: z
              .string()
              .min(1)
              .max(ASSISTANT_CLIENT_DTO_BOUNDS.maxBlockCharacters),
            citationNumbers: z
              .array(z.number().int().positive())
              .min(1)
              .max(ASSISTANT_CLIENT_DTO_BOUNDS.maxCitationNumbersPerBlock),
          })
          .strict(),
      )
      .min(1)
      .max(ASSISTANT_CLIENT_DTO_BOUNDS.maxBlocks),
    citations: z
      .array(citationSchema)
      .min(1)
      .max(ASSISTANT_CLIENT_DTO_BOUNDS.maxCitations),
  })
  .strict();

const refusalSchema = z
  .object({
    status: z.enum([
      "insufficient_evidence",
      "validation_error",
      "rate_limited",
      "temporarily_unavailable",
    ]),
    message: z
      .string()
      .min(1)
      .max(ASSISTANT_CLIENT_DTO_BOUNDS.maxMessageCharacters),
    searchHref: z.string().min(1).optional(),
  })
  .strict();

export type AssistantClientAnswered = {
  status: "answered";
  blocks: Array<{ text: string; citationNumbers: number[] }>;
  citations: Array<{
    number: number;
    title: string;
    href: string;
    entityType: "article" | "prompt";
    excerpt?: string;
  }>;
};

export type AssistantClientRefusal = {
  status:
    | "insufficient_evidence"
    | "validation_error"
    | "rate_limited"
    | "temporarily_unavailable";
  message: string;
  searchHref?: string;
};

export type AssistantClientResponse =
  | AssistantClientAnswered
  | AssistantClientRefusal;

export type AssistantParseOk = {
  ok: true;
  response: AssistantClientResponse;
};

export type AssistantParseFail = {
  ok: false;
  reason: "malformed";
};

function httpMatchesStatus(httpStatus: number, status: string): boolean {
  if (status === "answered" || status === "insufficient_evidence") {
    return httpStatus === 200;
  }
  if (status === "validation_error") {
    return (
      httpStatus === 400 ||
      httpStatus === 403 ||
      httpStatus === 413 ||
      httpStatus === 415
    );
  }
  if (status === "rate_limited") return httpStatus === 429;
  if (status === "temporarily_unavailable") return httpStatus === 503;
  return false;
}

function validateAnsweredGrounding(
  data: z.infer<typeof answeredSchema>,
): AssistantClientAnswered | null {
  const numbers = data.citations.map((c) => c.number);
  if (new Set(numbers).size !== numbers.length) return null;

  const byNumber = new Map(data.citations.map((c) => [c.number, c]));
  const used = new Set<number>();

  for (const block of data.blocks) {
    const unique = new Set(block.citationNumbers);
    if (unique.size !== block.citationNumbers.length) return null;
    for (const n of block.citationNumbers) {
      if (!byNumber.has(n)) return null;
      used.add(n);
    }
  }

  if (used.size !== data.citations.length) return null;

  const citations: AssistantClientAnswered["citations"] = [];
  for (const c of data.citations) {
    if (!isSafePublicSearchHref(c.href)) return null;
    const item: AssistantClientAnswered["citations"][number] = {
      number: c.number,
      title: c.title,
      href: c.href,
      entityType: c.entityType,
    };
    if (c.excerpt) item.excerpt = c.excerpt;
    citations.push(item);
  }

  return {
    status: "answered",
    blocks: data.blocks.map((b) => ({
      text: b.text,
      citationNumbers: [...b.citationNumbers],
    })),
    citations,
  };
}

/**
 * Safe-parse a public assistant JSON body. Fail-closed: no partial answered DTO.
 */
export function parseAssistantPublicResponse(
  httpStatus: number,
  raw: unknown,
): AssistantParseOk | AssistantParseFail {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "malformed" };
  }

  const status = (raw as { status?: unknown }).status;
  if (status === "answered") {
    const parsed = answeredSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "malformed" };
    if (!httpMatchesStatus(httpStatus, "answered")) {
      return { ok: false, reason: "malformed" };
    }
    const grounded = validateAnsweredGrounding(parsed.data);
    if (!grounded) return { ok: false, reason: "malformed" };
    return { ok: true, response: grounded };
  }

  const parsed = refusalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "malformed" };
  if (!httpMatchesStatus(httpStatus, parsed.data.status)) {
    return { ok: false, reason: "malformed" };
  }

  const refusal: AssistantClientRefusal = {
    status: parsed.data.status,
    message: parsed.data.message,
  };

  if (parsed.data.status === "insufficient_evidence" && parsed.data.searchHref) {
    const safe = assertSafeAssistantSearchHref(parsed.data.searchHref);
    if (safe) refusal.searchHref = safe;
  }

  return { ok: true, response: refusal };
}
