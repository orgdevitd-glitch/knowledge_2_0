import { z } from "zod";

import { isSafePublicSearchHref } from "@/domain/search/search-href";

import { ASSISTANT_LIMIT_DEFAULTS } from "./limits";
import { assertSafeAssistantPlainText } from "./output-safety";
import { sanitizeAssistantPlainText } from "./text";
import type {
  AssistantCitation,
  AssistantEvidenceChunk,
  AssistantEvidenceSource,
  AssistantProviderEvidence,
  AssistantProviderResult,
  AssistantRefusalCategory,
} from "./types";

export type CitationValidationOk = {
  ok: true;
  blocks: Array<{ text: string; evidenceKeys: string[]; citationNumbers: number[] }>;
  citations: AssistantCitation[];
};

export type CitationValidationFail = {
  ok: false;
  category: AssistantRefusalCategory;
};

export type CitationValidationResult =
  | CitationValidationOk
  | CitationValidationFail;

const providerAnsweredSchema = z
  .object({
    kind: z.literal("answered"),
    blocks: z
      .array(
        z
          .object({
            text: z.string(),
            evidenceKeys: z.array(z.string()),
          })
          .strict(),
      )
      .min(1),
    usage: z
      .object({
        inputCharacters: z.number().finite().nonnegative(),
        outputCharacters: z.number().finite().nonnegative(),
        evidenceSourceCount: z.number().finite().nonnegative(),
        evidenceChunkCount: z.number().finite().nonnegative(),
      })
      .strict(),
    finishReason: z.enum([
      "completed",
      "refused",
      "timeout",
      "unavailable",
      "invalid_output",
      "cancelled",
    ]),
    providerStatus: z.literal("ok"),
  })
  .strict();

const providerRefusedSchema = z
  .object({
    kind: z.literal("refused"),
    refusalCategory: z.string().min(1),
    usage: z
      .object({
        inputCharacters: z.number().finite().nonnegative(),
        outputCharacters: z.number().finite().nonnegative(),
        evidenceSourceCount: z.number().finite().nonnegative(),
        evidenceChunkCount: z.number().finite().nonnegative(),
      })
      .strict(),
    finishReason: z.enum([
      "completed",
      "refused",
      "timeout",
      "unavailable",
      "invalid_output",
      "cancelled",
    ]),
    providerStatus: z.enum(["ok", "unavailable", "timeout", "invalid"]),
  })
  .strict()
  .refine((v) => !("blocks" in v), { message: "refused_must_not_have_blocks" });

/**
 * Parse provider result with allowlist schema. Never trusts unknown keys.
 * Returns null → invalid_provider_response (no raw error leakage).
 */
export function parseProviderResult(
  raw: unknown,
): AssistantProviderResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const kind = (raw as { kind?: unknown }).kind;
  if (kind === "answered") {
    const parsed = providerAnsweredSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data;
  }
  if (kind === "refused") {
    const parsed = providerRefusedSchema.safeParse(raw);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      refusalCategory: parsed.data
        .refusalCategory as AssistantRefusalCategory,
    };
  }
  return null;
}

/**
 * Request-local evidence keys only — no module-level maps or counters.
 */
export function buildProviderEvidence(
  sources: readonly AssistantEvidenceSource[],
  chunks: readonly AssistantEvidenceChunk[],
): {
  providerEvidence: AssistantProviderEvidence[];
  keyToSourceId: Map<string, string>;
} {
  const sourceById = new Map(sources.map((s) => [s.sourceId, s]));
  const providerEvidence: AssistantProviderEvidence[] = [];
  const keyToSourceId = new Map<string, string>();
  let n = 1;
  for (const chunk of chunks) {
    const source = sourceById.get(chunk.sourceId);
    if (!source) continue;
    const evidenceKey = `E${n}`;
    n += 1;
    keyToSourceId.set(evidenceKey, source.sourceId);
    providerEvidence.push({
      evidenceKey,
      sourceLabel: evidenceKey,
      sourceTitle: source.title,
      entityType: source.entityType,
      evidenceText: chunk.text,
      instructionBoundary: "untrusted_data",
      trustBoundary: chunk.trustBoundary,
    });
  }
  return { providerEvidence, keyToSourceId };
}

export function validateAndBuildCitations(input: {
  providerResult: AssistantProviderResult;
  sources: readonly AssistantEvidenceSource[];
  chunks: readonly AssistantEvidenceChunk[];
  keyToSourceId: Map<string, string>;
  maxAnswerBlocks?: number;
  maxAnswerCharacters?: number;
  maxCitations?: number;
  maxEvidenceKeysPerBlock?: number;
  excerptMaxCharacters?: number;
}): CitationValidationResult {
  if (input.providerResult.kind === "refused") {
    return { ok: false, category: input.providerResult.refusalCategory };
  }

  const maxBlocks =
    input.maxAnswerBlocks ?? ASSISTANT_LIMIT_DEFAULTS.maxAnswerBlocks;
  const maxAnswerChars =
    input.maxAnswerCharacters ?? ASSISTANT_LIMIT_DEFAULTS.maxAnswerCharacters;
  const maxCitations =
    input.maxCitations ?? ASSISTANT_LIMIT_DEFAULTS.maxCitations;
  const maxKeys =
    input.maxEvidenceKeysPerBlock ??
    ASSISTANT_LIMIT_DEFAULTS.maxEvidenceKeysPerBlock;
  const excerptMax =
    input.excerptMaxCharacters ?? ASSISTANT_LIMIT_DEFAULTS.excerptMaxCharacters;

  const blocks = input.providerResult.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, category: "invalid_provider_response" };
  }
  if (blocks.length > maxBlocks) {
    return { ok: false, category: "output_limit_exceeded" };
  }

  const sourceById = new Map(input.sources.map((s) => [s.sourceId, s]));
  const chunkBySource = new Map<string, AssistantEvidenceChunk[]>();
  for (const chunk of input.chunks) {
    const list = chunkBySource.get(chunk.sourceId) ?? [];
    list.push(chunk);
    chunkBySource.set(chunk.sourceId, list);
  }

  const citationNumberBySourceId = new Map<string, number>();
  const citations: AssistantCitation[] = [];
  const publicBlocks: CitationValidationOk["blocks"] = [];
  let totalChars = 0;

  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      return { ok: false, category: "invalid_provider_response" };
    }
    const text = sanitizeAssistantPlainText(
      typeof block.text === "string" ? block.text : "",
    );
    if (!text) {
      return { ok: false, category: "invalid_provider_response" };
    }
    const safety = assertSafeAssistantPlainText(text);
    if (!safety.ok) {
      return { ok: false, category: "invalid_provider_response" };
    }
    totalChars += text.length;
    if (totalChars > maxAnswerChars) {
      return { ok: false, category: "output_limit_exceeded" };
    }

    const rawKeys = Array.isArray(block.evidenceKeys)
      ? block.evidenceKeys
      : [];
    if (rawKeys.length === 0) {
      return { ok: false, category: "missing_citations" };
    }

    const uniqueKeys = [...new Set(rawKeys.map(String))];
    if (uniqueKeys.length > maxKeys) {
      return { ok: false, category: "output_limit_exceeded" };
    }

    const citationNumbers: number[] = [];
    for (const key of uniqueKeys) {
      if (!/^E\d+$/.test(key)) {
        return { ok: false, category: "missing_citations" };
      }
      const sourceId = input.keyToSourceId.get(key);
      if (!sourceId) {
        return { ok: false, category: "missing_citations" };
      }
      const source = sourceById.get(sourceId);
      if (!source || !isSafePublicSearchHref(source.href)) {
        return { ok: false, category: "stale_evidence" };
      }
      let number = citationNumberBySourceId.get(sourceId);
      if (number == null) {
        if (citations.length >= maxCitations) {
          return { ok: false, category: "output_limit_exceeded" };
        }
        number = citations.length + 1;
        citationNumberBySourceId.set(sourceId, number);
        const firstChunk = chunkBySource.get(sourceId)?.[0];
        citations.push({
          number,
          title: source.title,
          href: source.href,
          entityType: source.entityType,
          excerpt: firstChunk
            ? sanitizeAssistantPlainText(firstChunk.text).slice(0, excerptMax)
            : undefined,
        });
      }
      if (!citationNumbers.includes(number)) {
        citationNumbers.push(number);
      }
    }

    publicBlocks.push({ text, evidenceKeys: uniqueKeys, citationNumbers });
  }

  return { ok: true, blocks: publicBlocks, citations };
}

/** Allowlist public answered DTO — strips evidenceKeys and internals. */
export function toPublicAnsweredDto(input: {
  blocks: CitationValidationOk["blocks"];
  citations: AssistantCitation[];
}): {
  status: "answered";
  blocks: Array<{ text: string; citationNumbers: number[] }>;
  citations: Array<{
    number: number;
    title: string;
    href: string;
    entityType: "article" | "prompt";
    excerpt?: string;
  }>;
} {
  return {
    status: "answered",
    blocks: input.blocks.map((b) => ({
      text: b.text,
      citationNumbers: [...b.citationNumbers],
    })),
    citations: input.citations.map((c) => {
      const item: {
        number: number;
        title: string;
        href: string;
        entityType: "article" | "prompt";
        excerpt?: string;
      } = {
        number: c.number,
        title: c.title,
        href: c.href,
        entityType: c.entityType,
      };
      if (c.excerpt) item.excerpt = c.excerpt;
      return item;
    }),
  };
}
