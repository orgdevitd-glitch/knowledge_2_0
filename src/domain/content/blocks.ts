import { z } from "zod";

import {
  UnsupportedBlockSchemaVersionError,
  UnknownBlockTypeError,
  ValidationError,
} from "../shared/errors";
import { BlockId, MediaId, PromptId, ArticleId, VideoId } from "../shared/ids";
import { CONTENT_LIMITS } from "../shared/limits";
import {
  parseRichTextDocument,
  richTextDocumentSchema,
} from "../shared/rich-text";
import { parseSafeUrl } from "../shared/url";

export const BLOCK_SCHEMA_VERSION = 1 as const;

export const BLOCK_TYPES = [
  "heading",
  "paragraph",
  "list",
  "table",
  "image",
  "gallery",
  "video",
  "file",
  "button",
  "link",
  "quote",
  "info",
  "warning",
  "tip",
  "steps",
  "checklist",
  "faq",
  "prompt",
  "code",
  "related-content",
  "divider",
  "table-of-contents",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const blockSettingsSchema = z.object({
  anchor: z
    .string()
    .min(1)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  spacing: z.enum(["none", "sm", "md", "lg"]).optional(),
  width: z.enum(["content", "wide", "full"]).optional(),
  alignment: z.enum(["start", "center", "end"]).optional(),
});

export type BlockSettings = z.infer<typeof blockSettingsSchema>;

export const blockVisibilitySchema = z.enum(["all", "internal"]);
export type BlockVisibility = z.infer<typeof blockVisibilitySchema>;

const blockBase = {
  id: z.string().min(1).max(CONTENT_LIMITS.id.max),
  schemaVersion: z.literal(BLOCK_SCHEMA_VERSION),
  settings: blockSettingsSchema.default({}),
  visibility: blockVisibilitySchema.default("all"),
};

const headingData = z.object({
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  text: z.string().trim().min(1).max(CONTENT_LIMITS.title.max),
});

const paragraphData = z.object({
  content: richTextDocumentSchema,
});

const listData = z.object({
  style: z.enum(["ordered", "unordered"]),
  items: z
    .array(z.string().trim().min(1).max(2000))
    .min(CONTENT_LIMITS.listItems.min)
    .max(CONTENT_LIMITS.listItems.max),
});

const tableData = z.object({
  columns: z
    .array(z.string().trim().min(1).max(200))
    .min(CONTENT_LIMITS.tableColumns.min)
    .max(CONTENT_LIMITS.tableColumns.max),
  rows: z
    .array(z.array(z.string().max(2000)))
    .max(CONTENT_LIMITS.tableRows.max),
  caption: z.string().max(500).optional(),
});

const imageItem = z.object({
  mediaId: z.string().min(1).max(CONTENT_LIMITS.id.max),
  alt: z.string().max(500),
  caption: z.string().max(500).optional(),
  decorative: z.boolean(),
});

const imageData = imageItem.superRefine((data, ctx) => {
  if (!data.decorative && data.alt.trim().length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "alt is required unless decorative is true",
      path: ["alt"],
    });
  }
});

const galleryData = z.object({
  items: z
    .array(imageData)
    .min(CONTENT_LIMITS.galleryItems.min)
    .max(CONTENT_LIMITS.galleryItems.max),
});

const videoData = z.object({
  videoId: z.string().min(1).max(CONTENT_LIMITS.id.max).optional(),
  mediaId: z.string().min(1).max(CONTENT_LIMITS.id.max).optional(),
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max),
  transcriptId: z.string().min(1).max(CONTENT_LIMITS.id.max).optional(),
  posterMediaId: z.string().min(1).max(CONTENT_LIMITS.id.max).optional(),
  autoplay: z.literal(false).default(false),
});

const fileData = z.object({
  mediaId: z.string().min(1).max(CONTENT_LIMITS.id.max),
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max),
  description: z.string().max(CONTENT_LIMITS.summary.max).optional(),
  mimeType: z.string().max(128).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const buttonData = z.object({
  label: z.string().trim().min(1).max(120),
  href: z.string().min(1).max(CONTENT_LIMITS.url.max),
  variant: z.enum(["primary", "secondary", "ghost"]),
  openInNewTab: z.boolean().default(false),
});

const linkData = z.object({
  label: z.string().trim().min(1).max(200),
  href: z.string().min(1).max(CONTENT_LIMITS.url.max),
  linkType: z.enum(["internal", "external"]),
});

const quoteData = z.object({
  text: z.string().trim().min(1).max(5000),
  attribution: z.string().max(200).optional(),
});

const calloutData = z.object({
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(5000),
});

const stepItem = z.object({
  id: z.string().min(1).max(CONTENT_LIMITS.id.max),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

const stepsData = z.object({
  items: z
    .array(stepItem)
    .min(CONTENT_LIMITS.steps.min)
    .max(CONTENT_LIMITS.steps.max),
});

const checklistItem = z.object({
  id: z.string().min(1).max(CONTENT_LIMITS.id.max),
  text: z.string().trim().min(1).max(2000),
});

const checklistData = z.object({
  items: z
    .array(checklistItem)
    .min(CONTENT_LIMITS.checklistItems.min)
    .max(CONTENT_LIMITS.checklistItems.max),
});

const faqItem = z.object({
  id: z.string().min(1).max(CONTENT_LIMITS.id.max),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(5000),
});

const faqData = z.object({
  items: z
    .array(faqItem)
    .min(CONTENT_LIMITS.faqItems.min)
    .max(CONTENT_LIMITS.faqItems.max),
});

/** Prompt block references PromptId — single source of truth. */
const promptData = z.object({
  promptId: z.string().min(1).max(CONTENT_LIMITS.id.max),
  showTitle: z.boolean().default(true),
  showCopyButton: z.boolean().default(true),
});

const codeData = z.object({
  code: z.string().min(1).max(CONTENT_LIMITS.code.max),
  language: z.string().min(1).max(64),
  filename: z.string().max(256).optional(),
  executable: z.literal(false).default(false),
});

const relatedItem = z.discriminatedUnion("entityType", [
  z.object({
    entityType: z.literal("article"),
    entityId: z.string().min(1).max(CONTENT_LIMITS.id.max),
  }),
  z.object({
    entityType: z.literal("prompt"),
    entityId: z.string().min(1).max(CONTENT_LIMITS.id.max),
  }),
  z.object({
    entityType: z.literal("video"),
    entityId: z.string().min(1).max(CONTENT_LIMITS.id.max),
  }),
]);

const relatedContentData = z.object({
  items: z
    .array(relatedItem)
    .min(CONTENT_LIMITS.relatedContentItems.min)
    .max(CONTENT_LIMITS.relatedContentItems.max),
});

const dividerData = z.object({}).strict();

const tocData = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("auto") }),
  z.object({
    mode: z.literal("anchors"),
    anchors: z
      .array(z.string().min(1).max(96))
      .min(1)
      .max(100),
  }),
]);

export const blockSchemas = {
  heading: z.object({ ...blockBase, type: z.literal("heading"), data: headingData }),
  paragraph: z.object({
    ...blockBase,
    type: z.literal("paragraph"),
    data: paragraphData,
  }),
  list: z.object({ ...blockBase, type: z.literal("list"), data: listData }),
  table: z.object({ ...blockBase, type: z.literal("table"), data: tableData }),
  image: z.object({ ...blockBase, type: z.literal("image"), data: imageData }),
  gallery: z.object({
    ...blockBase,
    type: z.literal("gallery"),
    data: galleryData,
  }),
  video: z.object({ ...blockBase, type: z.literal("video"), data: videoData }),
  file: z.object({ ...blockBase, type: z.literal("file"), data: fileData }),
  button: z.object({
    ...blockBase,
    type: z.literal("button"),
    data: buttonData,
  }),
  link: z.object({ ...blockBase, type: z.literal("link"), data: linkData }),
  quote: z.object({ ...blockBase, type: z.literal("quote"), data: quoteData }),
  info: z.object({ ...blockBase, type: z.literal("info"), data: calloutData }),
  warning: z.object({
    ...blockBase,
    type: z.literal("warning"),
    data: calloutData,
  }),
  tip: z.object({ ...blockBase, type: z.literal("tip"), data: calloutData }),
  steps: z.object({ ...blockBase, type: z.literal("steps"), data: stepsData }),
  checklist: z.object({
    ...blockBase,
    type: z.literal("checklist"),
    data: checklistData,
  }),
  faq: z.object({ ...blockBase, type: z.literal("faq"), data: faqData }),
  prompt: z.object({
    ...blockBase,
    type: z.literal("prompt"),
    data: promptData,
  }),
  code: z.object({ ...blockBase, type: z.literal("code"), data: codeData }),
  "related-content": z.object({
    ...blockBase,
    type: z.literal("related-content"),
    data: relatedContentData,
  }),
  divider: z.object({
    ...blockBase,
    type: z.literal("divider"),
    data: dividerData,
  }),
  "table-of-contents": z.object({
    ...blockBase,
    type: z.literal("table-of-contents"),
    data: tocData,
  }),
} as const;

export type ContentBlock = {
  [K in BlockType]: z.infer<(typeof blockSchemas)[K]>;
}[BlockType];

export type BlockMigration = {
  fromVersion: number;
  toVersion: number;
  migrate: (block: unknown) => unknown;
};

/** Future migrations register here; Phase 3 supports current version only. */
export const blockMigrations: BlockMigration[] = [];

function assertNoRawHtml(text: string, path: string): void {
  if (/<\s*\/?\s*[a-zA-Z][^>]*>/.test(text) || /javascript:/i.test(text)) {
    throw new ValidationError("Raw HTML / unsafe markup is not allowed", {
      path,
    });
  }
}

function domainRefineBlock(block: ContentBlock): ContentBlock {
  BlockId.parse(block.id);

  if (block.type === "paragraph") {
    parseRichTextDocument(block.data.content);
  }

  if (block.type === "table") {
    const cols = block.data.columns.length;
    for (let i = 0; i < block.data.rows.length; i += 1) {
      const row = block.data.rows[i];
      if (!row || row.length !== cols) {
        throw new ValidationError(
          "Table row cell count must match columns",
          { row: i, expected: cols, actual: row?.length ?? 0 },
        );
      }
      for (const cell of row) {
        assertNoRawHtml(cell, `table.rows[${i}]`);
      }
    }
    for (const col of block.data.columns) {
      assertNoRawHtml(col, "table.columns");
    }
  }

  if (block.type === "gallery") {
    const mediaIds = block.data.items.map((i) => i.mediaId);
    if (new Set(mediaIds).size !== mediaIds.length) {
      throw new ValidationError("Gallery must not contain duplicate mediaId");
    }
    for (const item of block.data.items) {
      MediaId.parse(item.mediaId);
    }
  }

  if (block.type === "image") {
    MediaId.parse(block.data.mediaId);
  }

  if (block.type === "video") {
    if (!block.data.videoId && !block.data.mediaId) {
      throw new ValidationError("Video block requires videoId or mediaId");
    }
    if (block.data.videoId) VideoId.parse(block.data.videoId);
    if (block.data.mediaId) MediaId.parse(block.data.mediaId);
    if (block.data.autoplay !== false) {
      throw new ValidationError("Video block autoplay must be false");
    }
  }

  if (block.type === "file") {
    MediaId.parse(block.data.mediaId);
  }

  if (block.type === "button") {
    parseSafeUrl(block.data.href, { allowRelative: true });
  }

  if (block.type === "link") {
    const url = parseSafeUrl(block.data.href, {
      allowRelative: block.data.linkType === "internal",
      requireHttpsAbsolute: block.data.linkType === "external",
    });
    if (block.data.linkType === "external" && !url.startsWith("https://")) {
      throw new ValidationError("External link must be HTTPS");
    }
    if (block.data.linkType === "internal" && !url.startsWith("/")) {
      throw new ValidationError("Internal link must be a relative path");
    }
  }

  if (block.type === "prompt") {
    PromptId.parse(block.data.promptId);
  }

  if (block.type === "related-content") {
    const keys = block.data.items.map(
      (i) => `${i.entityType}:${i.entityId}`,
    );
    if (new Set(keys).size !== keys.length) {
      throw new ValidationError("Related content must not contain duplicates");
    }
    for (const item of block.data.items) {
      if (item.entityType === "article") ArticleId.parse(item.entityId);
      if (item.entityType === "prompt") PromptId.parse(item.entityId);
      if (item.entityType === "video") VideoId.parse(item.entityId);
    }
  }

  if (block.type === "steps") {
    const ids = block.data.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError("Steps must have unique ids");
    }
  }

  if (block.type === "checklist") {
    const ids = block.data.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError("Checklist items must have unique ids");
    }
  }

  if (block.type === "faq") {
    const ids = block.data.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError("FAQ items must have unique ids");
    }
  }

  if (block.type === "code" && block.data.executable !== false) {
    throw new ValidationError("Code block executable must be false");
  }

  return block;
}

export function validateBlock(input: unknown): ContentBlock {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Block must be an object");
  }
  const record = input as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string" || !(type in blockSchemas)) {
    throw new UnknownBlockTypeError("Unknown block type", { type });
  }
  const schemaVersion = record.schemaVersion;
  if (schemaVersion !== BLOCK_SCHEMA_VERSION) {
    throw new UnsupportedBlockSchemaVersionError(
      "Unsupported block schema version",
      { type, schemaVersion, supported: BLOCK_SCHEMA_VERSION },
    );
  }

  const schema = blockSchemas[type as BlockType];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid block", {
      type,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
    });
  }

  return domainRefineBlock(parsed.data as ContentBlock);
}

export function validateBlocks(blocks: unknown[]): ContentBlock[] {
  if (blocks.length > CONTENT_LIMITS.blocksPerArticle) {
    throw new ValidationError("Too many blocks", {
      max: CONTENT_LIMITS.blocksPerArticle,
      actual: blocks.length,
    });
  }
  const validated = blocks.map(validateBlock);
  const ids = validated.map((b) => b.id);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError("Duplicate BlockId in article blocks");
  }
  return validated;
}

export function reorderBlocks(
  blocks: readonly ContentBlock[],
  orderedIds: readonly string[],
): ContentBlock[] {
  if (orderedIds.length !== blocks.length) {
    throw new ValidationError("Reorder must include all block ids");
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new ValidationError("Reorder ids must be unique");
  }
  const map = new Map(blocks.map((b) => [b.id, b]));
  const result: ContentBlock[] = [];
  for (const id of orderedIds) {
    const block = map.get(id);
    if (!block) {
      throw new ValidationError("Unknown block id in reorder", { id });
    }
    result.push(block);
  }
  return result;
}
