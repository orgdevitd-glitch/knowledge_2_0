"use client";

import {
  AdminMutationClientError,
  type AdminApiError,
} from "@/features/admin/articles/client/admin-articles-api";

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
  body: Record<string, unknown> = {},
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

async function getJson<T>(url: string): Promise<T> {
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

export const googleIntegrationsApi = {
  status() {
    return getJson<{
      mode: string;
      available: boolean;
      activeSourceCount?: number;
      recentImports?: Array<Record<string, unknown>>;
      message?: string;
    }>("/api/admin/integrations/google/status");
  },
  testConnection() {
    return mutate<{ ok: boolean; rootFolderName: string }>(
      "/api/admin/integrations/google/test",
      "POST",
    );
  },
  listFolder(folderId: string, query?: { pageToken?: string; q?: string }) {
    const params = new URLSearchParams();
    if (query?.pageToken) params.set("pageToken", query.pageToken);
    if (query?.q) params.set("q", query.q);
    const qs = params.toString();
    return getJson<{
      folderId: string;
      folderName: string;
      parentId: string | null;
      canGoUp: boolean;
      items: Array<{
        id: string;
        name: string;
        mimeType: string;
        modifiedTime: string | null;
        supported: boolean;
      }>;
      nextPageToken: string | null;
    }>(
      `/api/admin/integrations/google/drive/folders/${folderId}${qs ? `?${qs}` : ""}`,
    );
  },
  createSource(body: Record<string, unknown>) {
    return mutate<{ connection: Record<string, unknown> }>(
      "/api/admin/integrations/google/sources",
      "POST",
      body,
    );
  },
  testSource(sourceId: string) {
    return mutate<{ ok: boolean; connection: Record<string, unknown> }>(
      `/api/admin/integrations/google/sources/${sourceId}/test`,
      "POST",
    );
  },
  preview(sourceId: string, body: Record<string, unknown> = {}) {
    return mutate<{ importJob: { id: string } }>(
      `/api/admin/integrations/google/sources/${sourceId}/preview`,
      "POST",
      body,
    );
  },
  archive(sourceId: string) {
    return mutate<{ connection: Record<string, unknown> }>(
      `/api/admin/integrations/google/sources/${sourceId}/archive`,
      "POST",
    );
  },
  confirm(importJobId: string, body: Record<string, unknown>) {
    return mutate<Record<string, unknown>>(
      `/api/admin/integrations/google/imports/${importJobId}/confirm`,
      "POST",
      body,
    );
  },
  cancel(importJobId: string) {
    return mutate<{ importJob: Record<string, unknown> }>(
      `/api/admin/integrations/google/imports/${importJobId}/cancel`,
      "POST",
    );
  },
};
