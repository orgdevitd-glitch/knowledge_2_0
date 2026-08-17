import {
  parseAssistantPublicResponse,
  type AssistantClientResponse,
} from "./public-dto";

const ASK_PATH = "/api/assistant/ask";

export type AssistantAskClientFilters = {
  type?: "article" | "prompt" | "all";
  category?: string | null;
  tag?: string | null;
  audience?: string | null;
};

export type AssistantAskClientRequest = {
  question: string;
  filters?: AssistantAskClientFilters;
};

export type AssistantClientOutcome =
  | { kind: "ok"; httpStatus: number; response: AssistantClientResponse }
  | { kind: "aborted" }
  | { kind: "network" }
  | { kind: "malformed" };

const TAXONOMY_ID_MAX = 128;

function allowlistedTaxonomyId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length < 1 || value.length > TAXONOMY_ID_MAX) return undefined;
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value;
}

function buildAllowlistedBody(input: AssistantAskClientRequest): string {
  const body: { question: string; filters?: AssistantAskClientFilters } = {
    question: input.question,
  };
  if (input.filters) {
    const filters: AssistantAskClientFilters = {};
    if (
      input.filters.type === "article" ||
      input.filters.type === "prompt" ||
      input.filters.type === "all"
    ) {
      filters.type = input.filters.type;
    }
    const category = allowlistedTaxonomyId(input.filters.category);
    const tag = allowlistedTaxonomyId(input.filters.tag);
    const audience = allowlistedTaxonomyId(input.filters.audience);
    if (category) filters.category = category;
    if (tag) filters.tag = tag;
    if (audience) filters.audience = audience;
    if (Object.keys(filters).length > 0) body.filters = filters;
  }
  return JSON.stringify(body);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

/**
 * Browser client for POST /api/assistant/ask.
 * Relative URL only; allowlisted JSON body; no provider/model/headers.
 * Does not log question or answer.
 */
export async function askAssistantClient(
  input: AssistantAskClientRequest,
  options?: { signal?: AbortSignal },
): Promise<AssistantClientOutcome> {
  let response: Response;
  try {
    response = await fetch(ASK_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: buildAllowlistedBody(input),
      signal: options?.signal,
    });
  } catch (error) {
    if (isAbortError(error) || options?.signal?.aborted) {
      return { kind: "aborted" };
    }
    return { kind: "network" };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    if (options?.signal?.aborted) return { kind: "aborted" };
    return { kind: "malformed" };
  }

  const parsed = parseAssistantPublicResponse(response.status, raw);
  if (!parsed.ok) return { kind: "malformed" };
  return {
    kind: "ok",
    httpStatus: response.status,
    response: parsed.response,
  };
}
