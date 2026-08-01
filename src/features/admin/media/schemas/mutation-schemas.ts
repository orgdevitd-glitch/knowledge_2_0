import { z } from "zod";

import { MEDIA_KIND_VALUES, MEDIA_LIMIT_DEFAULTS } from "@/domain/shared/media-limits";
import { CONTENT_LIMITS } from "@/domain/shared/limits";

const csrfField = z.object({
  csrfToken: z.string().min(20).max(1024),
});

const revisionField = z.object({
  expectedRevision: z.number().int().nonnegative(),
});

export const startMediaUploadBodySchema = csrfField.extend({
  kind: z.enum(MEDIA_KIND_VALUES),
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max),
  description: z
    .string()
    .max(MEDIA_LIMIT_DEFAULTS.descriptionMax)
    .nullable()
    .optional(),
  defaultAltText: z
    .string()
    .max(MEDIA_LIMIT_DEFAULTS.defaultAltTextMax)
    .nullable()
    .optional(),
  originalFileName: z
    .string()
    .trim()
    .min(1)
    .max(MEDIA_LIMIT_DEFAULTS.originalFileNameMax),
  declaredSizeBytes: z.number().int().positive(),
});

export const completeMediaBodySchema = csrfField.merge(revisionField);

export const retryMediaBodySchema = csrfField.merge(revisionField);

export const updateMediaBodySchema = csrfField.merge(revisionField).extend({
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title.max).optional(),
  description: z
    .string()
    .max(MEDIA_LIMIT_DEFAULTS.descriptionMax)
    .nullable()
    .optional(),
  defaultAltText: z
    .string()
    .max(MEDIA_LIMIT_DEFAULTS.defaultAltTextMax)
    .nullable()
    .optional(),
});

export const revisionOnlyMediaBodySchema = csrfField.merge(revisionField);
