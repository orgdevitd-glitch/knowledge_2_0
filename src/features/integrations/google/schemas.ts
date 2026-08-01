import { z } from "zod";

export const csrfBodySchema = z.object({
  csrfToken: z.string().min(1),
});

export const createSourceBodySchema = csrfBodySchema.extend({
  urlOrId: z.string().min(1).max(2048),
  targetEntityType: z.enum(["article", "prompt-batch", "none"]).default("none"),
  targetEntityId: z.string().min(1).max(128).nullable().optional(),
});

export const previewSourceBodySchema = csrfBodySchema.extend({
  targetArticleId: z.string().min(1).max(128).nullable().optional(),
  dataSheetName: z.string().min(1).max(256).optional(),
});

export const confirmImportBodySchema = csrfBodySchema.extend({
  mode: z.enum(["metadata", "blocks", "both"]).optional(),
  createNew: z.boolean().optional(),
  targetArticleId: z.string().min(1).max(128).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(120).optional(),
  summary: z.string().max(2000).optional(),
  readyOnly: z.boolean().optional(),
});
