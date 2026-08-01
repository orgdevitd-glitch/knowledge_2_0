import type { ContentStatus } from "@/domain/shared/status";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import { ValidationError } from "@/domain/shared/errors";

export type ListSort =
  | "updatedAt_desc"
  | "updatedAt_asc"
  | "title_asc"
  | "createdAt_desc";

export type PaginationInput = {
  limit?: number;
  cursor?: string | null;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  limit: number;
};

export function normalizePagination(input: PaginationInput | undefined): {
  limit: number;
  cursor: string | null;
} {
  const limit = input?.limit ?? CONTENT_LIMITS.listDefaultLimit;
  if (limit < 1 || limit > CONTENT_LIMITS.listMaxLimit) {
    throw new ValidationError("Invalid list limit", {
      limit,
      max: CONTENT_LIMITS.listMaxLimit,
    });
  }
  return { limit, cursor: input?.cursor ?? null };
}

export type ContentListFilter = {
  status?: ContentStatus | ContentStatus[];
  categoryId?: string;
  tagId?: string;
  audienceId?: string;
  sort?: ListSort;
};

export type SaveOptions = {
  /** Expected current revision for optimistic concurrency. */
  expectedRevision: number;
};
