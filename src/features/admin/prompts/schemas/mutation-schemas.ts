import { z } from "zod";

import { CONTENT_LIMITS } from "@/domain/shared/limits";

const csrfField = z.object({
  csrfToken: z.string().min(20).max(1024),
});

const revisionField = z.object({
  expectedRevision: z.number().int().nonnegative(),
});

const optionalTextField = z
  .string()
  .max(CONTENT_LIMITS.plainText.max)
  .nullable()
  .optional();

export const createPromptBodySchema = csrfField.extend({
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max),
  slug: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.slug.min)
    .max(CONTENT_LIMITS.slug.max),
  summary: z.string().max(CONTENT_LIMITS.summary.max).nullable().optional(),
  promptText: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.promptText.min)
    .max(CONTENT_LIMITS.promptText.max),
  inputRequirements: optionalTextField,
  outputRequirements: optionalTextField,
  restrictions: optionalTextField,
  usageExample: optionalTextField,
  categoryIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.taxonomyIds)
    .default([]),
  tagIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.taxonomyIds)
    .default([]),
  audienceIds: z
    .array(z.string().min(1).max(CONTENT_LIMITS.id.max))
    .max(CONTENT_LIMITS.taxonomyIds)
    .default([]),
  reviewDueAt: z.string().min(1).max(40).nullable().optional(),
});

export const updatePromptBodySchema = csrfField.merge(revisionField).extend({
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max).optional(),
  slug: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.slug.min)
    .max(CONTENT_LIMITS.slug.max)
    .optional(),
  summary: z.string().max(CONTENT_LIMITS.summary.max).nullable().optional(),
  promptText: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.promptText.min)
    .max(CONTENT_LIMITS.promptText.max)
    .optional(),
  inputRequirements: optionalTextField,
  outputRequirements: optionalTextField,
  restrictions: optionalTextField,
  usageExample: optionalTextField,
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

export type CreatePromptBody = z.infer<typeof createPromptBodySchema>;
export type UpdatePromptBody = z.infer<typeof updatePromptBodySchema>;
