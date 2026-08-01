import { z } from "zod";

import { CONTENT_LIMITS } from "@/domain/shared/limits";

const csrfToken = z.string().min(20).max(1024);
const expectedRevision = z.number().int().min(0).max(1_000_000_000);
const slugSchema = z
  .string()
  .min(CONTENT_LIMITS.slug.min)
  .max(CONTENT_LIMITS.slug.max)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const titleSchema = z
  .string()
  .min(CONTENT_LIMITS.title.min)
  .max(CONTENT_LIMITS.title.max);
const descriptionSchema = z
  .string()
  .max(2_000)
  .nullable()
  .optional();
const sortOrderSchema = z.number().int().min(0).max(1_000_000).optional();

export const createCategoryBodySchema = z.object({
  csrfToken,
  title: titleSchema,
  slug: slugSchema,
  description: descriptionSchema,
  parentId: z.string().min(1).max(CONTENT_LIMITS.id.max).nullable().optional(),
  sortOrder: sortOrderSchema,
});

export const updateCategoryBodySchema = z.object({
  csrfToken,
  expectedRevision,
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema,
  sortOrder: sortOrderSchema,
});

export const moveCategoryBodySchema = z.object({
  csrfToken,
  expectedRevision,
  parentId: z.string().min(1).max(CONTENT_LIMITS.id.max).nullable(),
});

export const reorderCategoryBodySchema = z.object({
  csrfToken,
  expectedRevision,
  direction: z.enum(["up", "down", "position"]),
  position: z.number().int().min(0).max(10_000).optional(),
});

export const revisionOnlyBodySchema = z.object({
  csrfToken,
  expectedRevision,
});

export const createTagBodySchema = z.object({
  csrfToken,
  title: titleSchema,
  slug: slugSchema,
  description: descriptionSchema,
});

export const updateTagBodySchema = z.object({
  csrfToken,
  expectedRevision,
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema,
});

export const createAudienceBodySchema = z.object({
  csrfToken,
  title: titleSchema,
  slug: slugSchema,
  description: descriptionSchema,
  sortOrder: sortOrderSchema,
});

export const updateAudienceBodySchema = z.object({
  csrfToken,
  expectedRevision,
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema,
  sortOrder: sortOrderSchema,
});

export const reorderAudienceBodySchema = z.object({
  csrfToken,
  expectedRevision,
  direction: z.enum(["up", "down", "position"]),
  position: z.number().int().min(0).max(10_000).optional(),
});

export const taxonomyTypeSchema = z.enum(["category", "tag", "audience"]);
