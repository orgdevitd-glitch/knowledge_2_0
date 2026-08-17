import type { ArticleSnapshot } from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import type { PromptSnapshot } from "@/domain/content/prompt";
import { richTextToPlain } from "@/domain/shared/rich-text";

import { buildAssistantChunkId, buildAssistantSourceId } from "./chunk-id";
import { ASSISTANT_LIMIT_DEFAULTS } from "./limits";
import {
  clampAssistantText,
  sanitizeAssistantPlainText,
  splitTextDeterministically,
} from "./text";
import type {
  AssistantEvidenceChunk,
  AssistantEvidenceSource,
  AssistantEntityType,
} from "./types";

export type ChunkingLimits = {
  maxChunksPerSource: number;
  maxChunkCharacters: number;
  maxTotalEvidenceCharacters: number;
  maxSources: number;
};

type RawSection = {
  headingPath: string;
  sectionIdentity: string;
  text: string;
};

function extractBlockSections(
  block: ContentBlock,
  headingStack: string[],
): RawSection[] {
  if (block.visibility === "internal") return [];

  const path = headingStack.join(" > ") || "document";

  switch (block.type) {
    case "heading": {
      const level = block.data.level;
      while (headingStack.length >= level - 1) headingStack.pop();
      headingStack.push(sanitizeAssistantPlainText(block.data.text));
      return [
        {
          headingPath: headingStack.join(" > "),
          sectionIdentity: `heading:${block.id}`,
          text: block.data.text,
        },
      ];
    }
    case "paragraph":
      return [
        {
          headingPath: path,
          sectionIdentity: `paragraph:${block.id}`,
          text: richTextToPlain(block.data.content),
        },
      ];
    case "list":
      return [
        {
          headingPath: path,
          sectionIdentity: `list:${block.id}`,
          text: block.data.items.join("\n"),
        },
      ];
    case "table":
      return [
        {
          headingPath: path,
          sectionIdentity: `table:${block.id}`,
          text: [
            block.data.columns.join(" "),
            ...block.data.rows.map((r) => r.join(" ")),
            block.data.caption ?? "",
          ].join("\n"),
        },
      ];
    case "quote":
      return [
        {
          headingPath: path,
          sectionIdentity: `quote:${block.id}`,
          text: `${block.data.text} ${block.data.attribution ?? ""}`,
        },
      ];
    case "info":
    case "warning":
    case "tip":
      return [
        {
          headingPath: path,
          sectionIdentity: `${block.type}:${block.id}`,
          text: `${block.data.title ?? ""} ${block.data.body}`,
        },
      ];
    case "steps":
      return block.data.items.map((item, index) => ({
        headingPath: path,
        sectionIdentity: `steps:${block.id}:${item.id ?? index}`,
        text: `${item.title} ${item.description}`,
      }));
    case "checklist":
      return block.data.items.map((item, index) => ({
        headingPath: path,
        sectionIdentity: `checklist:${block.id}:${item.id ?? index}`,
        text: item.text,
      }));
    case "faq":
      return block.data.items.map((item, index) => ({
        headingPath: path,
        sectionIdentity: `faq:${block.id}:${item.id ?? index}`,
        text: `${item.question} ${item.answer}`,
      }));
    case "code":
      return [
        {
          headingPath: path,
          sectionIdentity: `code:${block.id}`,
          text: block.data.code,
        },
      ];
    case "image": {
      const alt = block.data.decorative ? "" : block.data.alt;
      const caption = block.data.caption ?? "";
      return [
        {
          headingPath: path,
          sectionIdentity: `image:${block.id}`,
          text: `${alt} ${caption}`.trim(),
        },
      ];
    }
    case "gallery":
      return [
        {
          headingPath: path,
          sectionIdentity: `gallery:${block.id}`,
          text: block.data.items
            .map((i) => {
              const alt = i.decorative ? "" : i.alt;
              return `${alt} ${i.caption ?? ""}`.trim();
            })
            .filter(Boolean)
            .join("\n"),
        },
      ];
    case "file":
      return [
        {
          headingPath: path,
          sectionIdentity: `file:${block.id}`,
          text: `${block.data.title} ${block.data.description ?? ""}`.trim(),
        },
      ];
    case "video":
      return [
        {
          headingPath: path,
          sectionIdentity: `video:${block.id}`,
          text: block.data.title,
        },
      ];
    case "link":
    case "button":
      return [
        {
          headingPath: path,
          sectionIdentity: `${block.type}:${block.id}`,
          text: block.data.label,
        },
      ];
    default:
      return [];
  }
}

function expandSections(
  sections: RawSection[],
  maxChunkCharacters: number,
): RawSection[] {
  const out: RawSection[] = [];
  for (const section of sections) {
    const text = sanitizeAssistantPlainText(section.text);
    if (!text) continue;
    const pieces = splitTextDeterministically(text, maxChunkCharacters);
    pieces.forEach((piece, index) => {
      out.push({
        headingPath: section.headingPath,
        sectionIdentity:
          pieces.length === 1
            ? section.sectionIdentity
            : `${section.sectionIdentity}:part${index}`,
        text: piece,
      });
    });
  }
  return out;
}

function materializeChunks(input: {
  entityType: AssistantEntityType;
  entityId: string;
  versionId: string;
  sourceId: string;
  trustBoundary: AssistantEvidenceChunk["trustBoundary"];
  sections: RawSection[];
  limits: ChunkingLimits;
  budgetRemaining: { chars: number };
}): AssistantEvidenceChunk[] {
  const chunks: AssistantEvidenceChunk[] = [];
  let ordinal = 0;
  for (const section of expandSections(
    input.sections,
    input.limits.maxChunkCharacters,
  )) {
    if (chunks.length >= input.limits.maxChunksPerSource) break;
    if (input.budgetRemaining.chars <= 0) break;
    const text = clampAssistantText(
      section.text,
      Math.min(input.limits.maxChunkCharacters, input.budgetRemaining.chars),
    );
    if (!text) continue;
    const chunkId = buildAssistantChunkId({
      entityType: input.entityType,
      entityId: input.entityId,
      versionId: input.versionId,
      ordinal,
      headingPath: section.headingPath,
      sectionIdentity: section.sectionIdentity,
    });
    chunks.push({
      chunkId,
      sourceId: input.sourceId,
      versionId: input.versionId,
      headingPath: section.headingPath,
      text,
      ordinal,
      characterCount: text.length,
      trustBoundary: input.trustBoundary,
    });
    input.budgetRemaining.chars -= text.length;
    ordinal += 1;
  }
  return chunks;
}

export function chunkArticleSnapshot(input: {
  entityId: string;
  versionId: string;
  title: string;
  href: string;
  publishedAt: string | null;
  snapshot: ArticleSnapshot;
  order: number;
  limits?: Partial<ChunkingLimits>;
  budgetRemaining: { chars: number };
}): { source: AssistantEvidenceSource; chunks: AssistantEvidenceChunk[] } {
  const limits: ChunkingLimits = {
    maxChunksPerSource:
      input.limits?.maxChunksPerSource ??
      ASSISTANT_LIMIT_DEFAULTS.maxChunksPerSource,
    maxChunkCharacters:
      input.limits?.maxChunkCharacters ??
      ASSISTANT_LIMIT_DEFAULTS.maxChunkCharacters,
    maxTotalEvidenceCharacters:
      input.limits?.maxTotalEvidenceCharacters ??
      ASSISTANT_LIMIT_DEFAULTS.maxTotalEvidenceCharacters,
    maxSources:
      input.limits?.maxSources ?? ASSISTANT_LIMIT_DEFAULTS.maxSources,
  };

  const sourceId = buildAssistantSourceId(
    "article",
    input.entityId,
    input.versionId,
  );
  const source: AssistantEvidenceSource = {
    sourceId,
    entityType: "article",
    entityId: input.entityId,
    versionId: input.versionId,
    title: sanitizeAssistantPlainText(input.title || input.snapshot.title),
    href: input.href,
    publishedAt: input.publishedAt,
    order: input.order,
  };

  const headingStack: string[] = [];
  const sections: RawSection[] = [
    {
      headingPath: "title",
      sectionIdentity: "title",
      text: input.snapshot.title,
    },
  ];
  if (input.snapshot.summary) {
    sections.push({
      headingPath: "summary",
      sectionIdentity: "summary",
      text: input.snapshot.summary,
    });
  }
  for (const block of input.snapshot.blocks) {
    sections.push(...extractBlockSections(block, headingStack));
  }

  const chunks = materializeChunks({
    entityType: "article",
    entityId: input.entityId,
    versionId: input.versionId,
    sourceId,
    trustBoundary: "published_content",
    sections,
    limits,
    budgetRemaining: input.budgetRemaining,
  });

  return { source, chunks };
}

export function chunkPromptSnapshot(input: {
  entityId: string;
  versionId: string;
  title: string;
  href: string;
  publishedAt: string | null;
  snapshot: PromptSnapshot;
  order: number;
  limits?: Partial<ChunkingLimits>;
  budgetRemaining: { chars: number };
}): { source: AssistantEvidenceSource; chunks: AssistantEvidenceChunk[] } {
  const limits: ChunkingLimits = {
    maxChunksPerSource:
      input.limits?.maxChunksPerSource ??
      ASSISTANT_LIMIT_DEFAULTS.maxChunksPerSource,
    maxChunkCharacters:
      input.limits?.maxChunkCharacters ??
      ASSISTANT_LIMIT_DEFAULTS.maxChunkCharacters,
    maxTotalEvidenceCharacters:
      input.limits?.maxTotalEvidenceCharacters ??
      ASSISTANT_LIMIT_DEFAULTS.maxTotalEvidenceCharacters,
    maxSources:
      input.limits?.maxSources ?? ASSISTANT_LIMIT_DEFAULTS.maxSources,
  };

  const sourceId = buildAssistantSourceId(
    "prompt",
    input.entityId,
    input.versionId,
  );
  const source: AssistantEvidenceSource = {
    sourceId,
    entityType: "prompt",
    entityId: input.entityId,
    versionId: input.versionId,
    title: sanitizeAssistantPlainText(input.title || input.snapshot.title),
    href: input.href,
    publishedAt: input.publishedAt,
    order: input.order,
  };

  const sections: RawSection[] = [
    {
      headingPath: "title",
      sectionIdentity: "title",
      text: input.snapshot.title,
    },
  ];
  if (input.snapshot.summary) {
    sections.push({
      headingPath: "summary",
      sectionIdentity: "summary",
      text: input.snapshot.summary,
    });
  }
  sections.push({
    headingPath: "promptText",
    sectionIdentity: "promptText",
    text: input.snapshot.promptText,
  });
  if (input.snapshot.inputRequirements) {
    sections.push({
      headingPath: "inputRequirements",
      sectionIdentity: "inputRequirements",
      text: input.snapshot.inputRequirements,
    });
  }
  if (input.snapshot.outputRequirements) {
    sections.push({
      headingPath: "outputRequirements",
      sectionIdentity: "outputRequirements",
      text: input.snapshot.outputRequirements,
    });
  }
  if (input.snapshot.restrictions) {
    sections.push({
      headingPath: "restrictions",
      sectionIdentity: "restrictions",
      text: input.snapshot.restrictions,
    });
  }
  if (input.snapshot.usageExample) {
    sections.push({
      headingPath: "usageExample",
      sectionIdentity: "usageExample",
      text: input.snapshot.usageExample,
    });
  }

  const chunks = materializeChunks({
    entityType: "prompt",
    entityId: input.entityId,
    versionId: input.versionId,
    sourceId,
    trustBoundary: "untrusted_prompt_reference",
    sections,
    limits,
    budgetRemaining: input.budgetRemaining,
  });

  return { source, chunks };
}
