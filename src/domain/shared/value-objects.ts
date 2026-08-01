import { z } from "zod";

import { ValidationError } from "./errors";
import type { Brand } from "./ids";
import { CONTENT_LIMITS } from "./limits";

/** ISO-8601 UTC instant string. */
export type IsoDateTime = Brand<string, "IsoDateTime">;

const isoDateTimeSchema = z
  .iso.datetime()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid datetime");

export function parseIsoDateTime(value: unknown): IsoDateTime {
  const result = isoDateTimeSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid DateTime", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as IsoDateTime;
}

export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString() as IsoDateTime;
}

export type Slug = Brand<string, "Slug">;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSlug(value: unknown): Slug {
  const result = z
    .string()
    .min(CONTENT_LIMITS.slug.min)
    .max(CONTENT_LIMITS.slug.max)
    .regex(SLUG_RE, "Slug must be lowercase latin, digits, single hyphens")
    .safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid Slug", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as unknown as Brand<string, "Slug">;
}

/**
 * Deterministic transliteration + slugify.
 * Does not check uniqueness; does not use locale-dependent casing.
 */
const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function slugify(input: string): Slug {
  const lower = input.normalize("NFKC").toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (CYRILLIC_MAP[ch] !== undefined) {
      out += CYRILLIC_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else if (/[\s_/.,;:]+/.test(ch) || ch === "-") {
      out += "-";
    }
  }
  out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!out) {
    throw new ValidationError("Slugify produced empty slug", { input });
  }
  if (out.length > CONTENT_LIMITS.slug.max) {
    out = out.slice(0, CONTENT_LIMITS.slug.max).replace(/-$/, "");
  }
  return parseSlug(out);
}

export type Title = Brand<string, "Title">;

export function parseTitle(value: unknown): Title {
  const result = z
    .string()
    .trim()
    .min(CONTENT_LIMITS.title.min)
    .max(CONTENT_LIMITS.title.max)
    .safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid Title", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as unknown as Brand<string, "Title">;
}

export type Summary = Brand<string, "Summary"> | null;

export function parseSummary(value: unknown): Summary {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const result = z
    .string()
    .trim()
    .max(CONTENT_LIMITS.summary.max)
    .safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid Summary", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as unknown as Brand<string, "Summary">;
}

export type PlainText = Brand<string, "PlainText">;

export function parsePlainText(
  value: unknown,
  max: number = CONTENT_LIMITS.plainText.max,
): PlainText {
  const result = z.string().min(1).max(max).safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid PlainText", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as unknown as Brand<string, "PlainText">;
}

export type SortOrder = Brand<number, "SortOrder">;

export function parseSortOrder(value: unknown): SortOrder {
  const result = z.number().int().min(0).max(1_000_000).safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid SortOrder", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as Brand<number, "SortOrder">;
}

export type VersionNumber = Brand<number, "VersionNumber">;

export function parseVersionNumber(value: unknown): VersionNumber {
  const result = z.number().int().min(1).safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid VersionNumber", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as Brand<number, "VersionNumber">;
}

export type ReviewDate = IsoDateTime | null;

export function parseReviewDate(value: unknown): ReviewDate {
  if (value === null || value === undefined) {
    return null;
  }
  return parseIsoDateTime(value);
}

export type Revision = Brand<number, "Revision">;

export function parseRevision(value: unknown): Revision {
  const result = z.number().int().min(0).safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid Revision", {
      issues: result.error.issues.map((i) => i.message),
    });
  }
  return result.data as Brand<number, "Revision">;
}

export function nextRevision(current: Revision): Revision {
  return (current + 1) as Revision;
}

export function initialRevision(): Revision {
  return 0 as Revision;
}

export function uniqueIds<T extends string>(ids: readonly T[]): T[] {
  return [...new Set(ids)];
}

export function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}
