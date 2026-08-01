"use client";

import type {
  AdminAudienceDto,
  AdminCategoryDto,
  AdminTagDto,
  TaxonomyUsageSummary,
} from "@/features/admin/taxonomy/types";
import {
  AdminMutationClientError,
  type AdminApiError,
} from "@/features/admin/articles/client/admin-articles-api";

export { AdminMutationClientError };

export type TaxonomyKind = "category" | "tag" | "audience";

export type TaxonomyUsageResponse = {
  summary: TaxonomyUsageSummary;
  items: TaxonomyUsageSummary["recentUsages"];
  nextCursor: string | null;
  limit: number;
};

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!res.ok) {
    throw new AdminMutationClientError(
      "CSRF_INVALID",
      "Не удалось получить CSRF token",
      {},
      res.status,
    );
  }
  const json = (await res.json()) as { csrfToken?: string };
  if (!json.csrfToken) {
    throw new AdminMutationClientError("CSRF_INVALID", "CSRF token missing");
  }
  return json.csrfToken;
}

async function mutate<T>(
  url: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, csrfToken }),
  });
  const json = (await res.json().catch(() => null)) as
    | ({ error?: AdminApiError } & Record<string, unknown>)
    | null;
  if (!res.ok) {
    const err = json?.error;
    throw new AdminMutationClientError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Ошибка запроса",
      err?.fields ?? {},
      res.status,
    );
  }
  return json as T;
}

async function adminGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  const json = (await res.json().catch(() => null)) as
    | ({ error?: AdminApiError } & Record<string, unknown>)
    | null;
  if (!res.ok) {
    const err = json?.error;
    throw new AdminMutationClientError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Ошибка запроса",
      err?.fields ?? {},
      res.status,
    );
  }
  return json as T;
}

export const adminTaxonomyApi = {
  createCategory(body: Record<string, unknown>) {
    return mutate<{ category: AdminCategoryDto }>(
      "/api/admin/taxonomy/categories",
      "POST",
      body,
    );
  },
  updateCategory(categoryId: string, body: Record<string, unknown>) {
    return mutate<{ category: AdminCategoryDto }>(
      `/api/admin/taxonomy/categories/${categoryId}`,
      "PATCH",
      body,
    );
  },
  moveCategory(categoryId: string, body: Record<string, unknown>) {
    return mutate<{ category: AdminCategoryDto }>(
      `/api/admin/taxonomy/categories/${categoryId}/move`,
      "POST",
      body,
    );
  },
  reorderCategory(categoryId: string, body: Record<string, unknown>) {
    return mutate<{ category: Pick<AdminCategoryDto, "id" | "sortOrder" | "revision"> }>(
      `/api/admin/taxonomy/categories/${categoryId}/reorder`,
      "POST",
      body,
    );
  },
  archiveCategory(categoryId: string, expectedRevision: number) {
    return mutate<{ category: Pick<AdminCategoryDto, "id" | "status" | "revision"> }>(
      `/api/admin/taxonomy/categories/${categoryId}/archive`,
      "POST",
      { expectedRevision },
    );
  },
  restoreCategory(categoryId: string, expectedRevision: number) {
    return mutate<{ category: Pick<AdminCategoryDto, "id" | "status" | "revision"> }>(
      `/api/admin/taxonomy/categories/${categoryId}/restore`,
      "POST",
      { expectedRevision },
    );
  },
  createTag(body: Record<string, unknown>) {
    return mutate<{ tag: AdminTagDto }>(
      "/api/admin/taxonomy/tags",
      "POST",
      body,
    );
  },
  updateTag(tagId: string, body: Record<string, unknown>) {
    return mutate<{ tag: AdminTagDto }>(
      `/api/admin/taxonomy/tags/${tagId}`,
      "PATCH",
      body,
    );
  },
  archiveTag(tagId: string, expectedRevision: number) {
    return mutate<{ tag: Pick<AdminTagDto, "id" | "status" | "revision"> }>(
      `/api/admin/taxonomy/tags/${tagId}/archive`,
      "POST",
      { expectedRevision },
    );
  },
  restoreTag(tagId: string, expectedRevision: number) {
    return mutate<{ tag: Pick<AdminTagDto, "id" | "status" | "revision"> }>(
      `/api/admin/taxonomy/tags/${tagId}/restore`,
      "POST",
      { expectedRevision },
    );
  },
  createAudience(body: Record<string, unknown>) {
    return mutate<{ audience: AdminAudienceDto }>(
      "/api/admin/taxonomy/audiences",
      "POST",
      body,
    );
  },
  updateAudience(audienceId: string, body: Record<string, unknown>) {
    return mutate<{ audience: AdminAudienceDto }>(
      `/api/admin/taxonomy/audiences/${audienceId}`,
      "PATCH",
      body,
    );
  },
  reorderAudience(audienceId: string, body: Record<string, unknown>) {
    return mutate<{ audience: Pick<AdminAudienceDto, "id" | "sortOrder" | "revision"> }>(
      `/api/admin/taxonomy/audiences/${audienceId}/reorder`,
      "POST",
      body,
    );
  },
  archiveAudience(audienceId: string, expectedRevision: number) {
    return mutate<{ audience: Pick<AdminAudienceDto, "id" | "status" | "revision"> }>(
      `/api/admin/taxonomy/audiences/${audienceId}/archive`,
      "POST",
      { expectedRevision },
    );
  },
  restoreAudience(audienceId: string, expectedRevision: number) {
    return mutate<{ audience: Pick<AdminAudienceDto, "id" | "status" | "revision"> }>(
      `/api/admin/taxonomy/audiences/${audienceId}/restore`,
      "POST",
      { expectedRevision },
    );
  },
  getUsage(
    taxonomyType: TaxonomyKind,
    taxonomyId: string,
    params?: { limit?: number; cursor?: string | null },
  ) {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.cursor) search.set("cursor", params.cursor);
    const qs = search.toString();
    return adminGet<TaxonomyUsageResponse>(
      `/api/admin/taxonomy/${taxonomyType}/${taxonomyId}/usage${qs ? `?${qs}` : ""}`,
    );
  },
};
