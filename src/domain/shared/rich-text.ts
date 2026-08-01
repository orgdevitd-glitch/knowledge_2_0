import { z } from "zod";

import { ValidationError } from "./errors";
import { CONTENT_LIMITS } from "./limits";
import { parseSafeUrl } from "./url";

/**
 * Minimal structured rich text for Phase 3.
 * Marks: bold | italic | code | link
 * Nodes: text | line-break
 * No raw HTML, scripts, CSS, or embeds.
 */
export const RICH_TEXT_SCHEMA_VERSION = 1 as const;

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("code") }),
  z.object({
    type: z.literal("link"),
    href: z.string().min(1).max(CONTENT_LIMITS.url.max),
  }),
]);

const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(CONTENT_LIMITS.plainText.max),
  marks: z.array(markSchema).max(8).optional(),
});

const lineBreakNodeSchema = z.object({
  type: z.literal("line-break"),
});

const inlineNodeSchema = z.discriminatedUnion("type", [
  textNodeSchema,
  lineBreakNodeSchema,
]);

export const richTextDocumentSchema = z.object({
  schemaVersion: z.literal(RICH_TEXT_SCHEMA_VERSION),
  nodes: z.array(inlineNodeSchema).min(1).max(2000),
});

export type RichTextMark = z.infer<typeof markSchema>;
export type RichTextNode = z.infer<typeof inlineNodeSchema>;
export type RichTextDocument = z.infer<typeof richTextDocumentSchema>;

export function parseRichTextDocument(value: unknown): RichTextDocument {
  const result = richTextDocumentSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid RichTextDocument", {
      issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  for (const node of result.data.nodes) {
    if (node.type === "text" && node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "link") {
          parseSafeUrl(mark.href, { allowRelative: true });
        }
      }
    }
  }
  return result.data;
}

export function richTextFromPlain(text: string): RichTextDocument {
  return {
    schemaVersion: RICH_TEXT_SCHEMA_VERSION,
    nodes: [{ type: "text", text }],
  };
}

export function richTextToPlain(doc: RichTextDocument): string {
  let out = "";
  for (const node of doc.nodes) {
    if (node.type === "text") {
      out += node.text;
    } else if (node.type === "line-break") {
      out += "\n";
    }
  }
  return out;
}
