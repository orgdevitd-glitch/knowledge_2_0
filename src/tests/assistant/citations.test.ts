import { describe, expect, it } from "vitest";

import {
  buildProviderEvidence,
  validateAndBuildCitations,
} from "@/domain/assistant/citations";
import type {
  AssistantEvidenceChunk,
  AssistantEvidenceSource,
  AssistantProviderResult,
} from "@/domain/assistant/types";

function source(
  overrides: Partial<AssistantEvidenceSource> & { sourceId: string },
): AssistantEvidenceSource {
  return {
    sourceId: overrides.sourceId,
    entityType: overrides.entityType ?? "article",
    entityId: overrides.entityId ?? "art_1",
    versionId: overrides.versionId ?? "ver_1",
    title: overrides.title ?? "Title",
    href: overrides.href ?? "/articles/title",
    publishedAt: overrides.publishedAt ?? null,
    order: overrides.order ?? 0,
  };
}

function chunk(
  overrides: Partial<AssistantEvidenceChunk> & {
    chunkId: string;
    sourceId: string;
  },
): AssistantEvidenceChunk {
  return {
    chunkId: overrides.chunkId,
    sourceId: overrides.sourceId,
    versionId: overrides.versionId ?? "ver_1",
    headingPath: overrides.headingPath ?? "body",
    text: overrides.text ?? "Evidence text",
    ordinal: overrides.ordinal ?? 0,
    characterCount: (overrides.text ?? "Evidence text").length,
    trustBoundary: overrides.trustBoundary ?? "published_content",
  };
}

describe("assistant citations", () => {
  it("accepts valid multi-block multi-source answer", () => {
    const sources = [
      source({ sourceId: "s1", entityId: "a1", href: "/articles/a1", title: "A" }),
      source({
        sourceId: "s2",
        entityId: "a2",
        href: "/articles/a2",
        title: "B",
        order: 1,
      }),
    ];
    const chunks = [
      chunk({ chunkId: "c1", sourceId: "s1", text: "Text A" }),
      chunk({ chunkId: "c2", sourceId: "s2", text: "Text B" }),
    ];
    const { providerEvidence, keyToSourceId } = buildProviderEvidence(
      sources,
      chunks,
    );
    const providerResult: AssistantProviderResult = {
      kind: "answered",
      blocks: [
        { text: "Первый блок", evidenceKeys: ["E1"] },
        { text: "Второй блок", evidenceKeys: ["E1", "E2"] },
      ],
      usage: {
        inputCharacters: 10,
        outputCharacters: 20,
        evidenceSourceCount: 2,
        evidenceChunkCount: 2,
      },
      finishReason: "completed",
      providerStatus: "ok",
    };
    const result = validateAndBuildCitations({
      providerResult,
      sources,
      chunks,
      keyToSourceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks).toHaveLength(2);
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]?.href).toBe("/articles/a1");
    expect(JSON.stringify(result)).not.toMatch(/versionId|chunkId|score/);
    expect(providerEvidence[0]?.instructionBoundary).toBe("untrusted_data");
  });

  it("rejects unknown missing empty duplicate-overflow keys and URLs", () => {
    const sources = [
      source({ sourceId: "s1", href: "/articles/a1" }),
    ];
    const chunks = [chunk({ chunkId: "c1", sourceId: "s1" })];
    const { keyToSourceId } = buildProviderEvidence(sources, chunks);

    const base = {
      sources,
      chunks,
      keyToSourceId,
    };

    expect(
      validateAndBuildCitations({
        ...base,
        providerResult: {
          kind: "answered",
          blocks: [{ text: "x", evidenceKeys: ["E999"] }],
          usage: {
            inputCharacters: 1,
            outputCharacters: 1,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        },
      }).ok,
    ).toBe(false);

    expect(
      validateAndBuildCitations({
        ...base,
        providerResult: {
          kind: "answered",
          blocks: [{ text: "x", evidenceKeys: [] }],
          usage: {
            inputCharacters: 1,
            outputCharacters: 1,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        },
      }).ok,
    ).toBe(false);

    expect(
      validateAndBuildCitations({
        ...base,
        providerResult: {
          kind: "answered",
          blocks: [
            {
              text: "see https://evil.example",
              evidenceKeys: ["E1"],
            },
          ],
          usage: {
            inputCharacters: 1,
            outputCharacters: 1,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        },
      }).ok,
    ).toBe(false);

    expect(
      validateAndBuildCitations({
        ...base,
        providerResult: {
          kind: "answered",
          blocks: [{ text: "", evidenceKeys: ["E1"] }],
          usage: {
            inputCharacters: 1,
            outputCharacters: 1,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        },
      }).ok,
    ).toBe(false);

    expect(
      validateAndBuildCitations({
        ...base,
        maxAnswerBlocks: 1,
        providerResult: {
          kind: "answered",
          blocks: [
            { text: "one", evidenceKeys: ["E1"] },
            { text: "two", evidenceKeys: ["E1"] },
          ],
          usage: {
            inputCharacters: 1,
            outputCharacters: 1,
            evidenceSourceCount: 1,
            evidenceChunkCount: 1,
          },
          finishReason: "completed",
          providerStatus: "ok",
        },
      }).ok,
    ).toBe(false);
  });

  it("normalizes duplicate evidence keys in a block", () => {
    const sources = [source({ sourceId: "s1", href: "/articles/a1" })];
    const chunks = [chunk({ chunkId: "c1", sourceId: "s1" })];
    const { keyToSourceId } = buildProviderEvidence(sources, chunks);
    const result = validateAndBuildCitations({
      sources,
      chunks,
      keyToSourceId,
      providerResult: {
        kind: "answered",
        blocks: [{ text: "ok", evidenceKeys: ["E1", "E1"] }],
        usage: {
          inputCharacters: 1,
          outputCharacters: 2,
          evidenceSourceCount: 1,
          evidenceChunkCount: 1,
        },
        finishReason: "completed",
        providerStatus: "ok",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks[0]?.citationNumbers).toEqual([1]);
  });
});
