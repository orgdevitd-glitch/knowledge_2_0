"use client";

import type { AdminMediaDto } from "@/features/admin/media/admin-media-dto";

export type AdminApiError = {
  code: string;
  message: string;
  fields: Record<string, string>;
};

export class AdminMutationClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly status = 400,
  ) {
    super(message);
    this.name = "AdminMutationClientError";
  }
}

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
    | ({ media?: AdminMediaDto; uploadUrl?: string; expiresAt?: string } & {
        error?: AdminApiError;
      })
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

export async function uploadMediaBinary(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  },
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: requiredHeaders,
    body: file,
  });
  if (!res.ok) {
    throw new AdminMutationClientError(
      "UPLOAD_FAILED",
      "Не удалось загрузить файл в хранилище",
      {},
      res.status,
    );
  }
}

export type StartUploadInput = {
  kind: string;
  title: string;
  description?: string | null;
  defaultAltText?: string | null;
  originalFileName: string;
  declaredSizeBytes: number;
};

export const adminMediaApi = {
  startUpload(body: StartUploadInput) {
    return mutate<{
      media: AdminMediaDto;
      uploadUrl: string;
      expiresAt: string;
      requiredHeaders: Record<string, string>;
    }>("/api/admin/media/uploads", "POST", body);
  },
  complete(mediaId: string, expectedRevision: number) {
    return mutate<{ media: AdminMediaDto }>(
      `/api/admin/media/${mediaId}/complete`,
      "POST",
      { expectedRevision },
    );
  },
  retry(mediaId: string, expectedRevision: number) {
    return mutate<{
      media: AdminMediaDto;
      uploadUrl: string;
      expiresAt: string;
      requiredHeaders: Record<string, string>;
    }>(`/api/admin/media/${mediaId}/retry`, "POST", { expectedRevision });
  },
  reissueUpload(mediaId: string, expectedRevision: number) {
    return mutate<{
      media: AdminMediaDto;
      uploadUrl: string;
      expiresAt: string;
      requiredHeaders: Record<string, string>;
    }>(
      `/api/admin/media/${mediaId}/reissue-upload`,
      "POST",
      { expectedRevision },
    );
  },
  archive(mediaId: string, expectedRevision: number) {
    return mutate<{ media: AdminMediaDto }>(
      `/api/admin/media/${mediaId}/archive`,
      "POST",
      { expectedRevision },
    );
  },
  restore(mediaId: string, expectedRevision: number) {
    return mutate<{ media: AdminMediaDto }>(
      `/api/admin/media/${mediaId}/restore`,
      "POST",
      { expectedRevision },
    );
  },
  updateMetadata(
    mediaId: string,
    body: {
      expectedRevision: number;
      title?: string;
      description?: string | null;
      defaultAltText?: string | null;
    },
  ) {
    return mutate<{ media: AdminMediaDto }>(
      `/api/admin/media/${mediaId}`,
      "PATCH",
      body,
    );
  },
};
