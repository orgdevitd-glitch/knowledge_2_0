import { z } from "zod";

import { CONTENT_LIMITS } from "@/domain/shared/limits";

const csrfField = z.object({
  csrfToken: z.string().min(20).max(1024),
});

const revisionField = z.object({
  expectedRevision: z.number().int().nonnegative(),
});

export const createArticleBodySchema = csrfField.extend({
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max),
  slug: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.slug.min)
    .max(CONTENT_LIMITS.slug.max),
  summary: z
    .string()
    .max(CONTENT_LIMITS.summary.max)
    .nullable()
    .optional(),
  categoryIds: z.array(z.string().min(1).max(CONTENT_LIMITS.id.max)).max(CONTENT_LIMITS.taxonomyIds).default([]),
  tagIds: z.array(z.string().min(1).max(CONTENT_LIMITS.id.max)).max(CONTENT_LIMITS.taxonomyIds).default([]),
  audienceIds: z.array(z.string().min(1).max(CONTENT_LIMITS.id.max)).max(CONTENT_LIMITS.taxonomyIds).default([]),
  reviewDueAt: z.string().min(1).max(40).nullable().optional(),
});

export const updateMetadataBodySchema = csrfField.merge(revisionField).extend({
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max).optional(),
  slug: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.slug.min)
    .max(CONTENT_LIMITS.slug.max)
    .optional(),
  summary: z.string().max(CONTENT_LIMITS.summary.max).nullable().optional(),
  categoryIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.taxonomyIds)
    .optional(),
  tagIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.taxonomyIds)
    .optional(),
  audienceIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.taxonomyIds)
    .optional(),
  reviewDueAt: z.string().min(1).max(40).nullable().optional(),
  relatedArticleIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.relatedIds)
    .optional(),
});

export const updateBlocksBodySchema = csrfField.merge(revisionField).extend({
  blocks: z.array(z.unknown()).max(CONTENT_LIMITS.blocksPerArticle),
});

export const publishBodySchema = csrfField.merge(revisionField).extend({
  changeSummary: z
    .string()
    .trim()
    .max(CONTENT_LIMITS.changeSummary.max)
    .optional(),
});

export const revisionOnlyBodySchema = csrfField.merge(revisionField);

export const restoreVersionBodySchema = csrfField.merge(revisionField).extend({
  changeSummary: z
    .string()
    .trim()
    .max(CONTENT_LIMITS.changeSummary.max)
    .optional(),
});

export type CreateArticleBody = z.infer<typeof createArticleBodySchema>;
export type UpdateMetadataBody = z.infer<typeof updateMetadataBodySchema>;
export type UpdateBlocksBody = z.infer<typeof updateBlocksBodySchema>;
