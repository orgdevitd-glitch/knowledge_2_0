import { z } from "zod";

import { ValidationError } from "./errors";
import { CONTENT_LIMITS } from "./limits";

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

function brandedString<B extends string>(
  brandName: B,
  schema: z.ZodString,
): {
  schema: z.ZodType<Brand<string, B>>;
  parse: (value: unknown) => Brand<string, B>;
} {
  const branded = schema.transform((v) => v as Brand<string, B>);
  return {
    schema: branded,
    parse(value: unknown) {
      const result = branded.safeParse(value);
      if (!result.success) {
        throw new ValidationError(`Invalid ${brandName}`, {
          brand: brandName,
          issues: result.error.issues.map((i) => i.message),
        });
      }
      return result.data;
    },
  };
}

const idBase = z
  .string()
  .min(CONTENT_LIMITS.id.min)
  .max(CONTENT_LIMITS.id.max)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, "ID must not contain control characters");

export const ArticleId = brandedString("ArticleId", idBase);
export type ArticleId = Brand<string, "ArticleId">;

export const PromptId = brandedString("PromptId", idBase);
export type PromptId = Brand<string, "PromptId">;

export const VideoId = brandedString("VideoId", idBase);
export type VideoId = Brand<string, "VideoId">;

export const CategoryId = brandedString("CategoryId", idBase);
export type CategoryId = Brand<string, "CategoryId">;

export const TagId = brandedString("TagId", idBase);
export type TagId = Brand<string, "TagId">;

export const AudienceId = brandedString("AudienceId", idBase);
export type AudienceId = Brand<string, "AudienceId">;

export const BlockId = brandedString("BlockId", idBase);
export type BlockId = Brand<string, "BlockId">;

export const VersionId = brandedString("VersionId", idBase);
export type VersionId = Brand<string, "VersionId">;

export const MediaId = brandedString("MediaId", idBase);
export type MediaId = Brand<string, "MediaId">;

export const UserId = brandedString("UserId", idBase);
export type UserId = Brand<string, "UserId">;

export const AuditEventId = brandedString("AuditEventId", idBase);
export type AuditEventId = Brand<string, "AuditEventId">;
