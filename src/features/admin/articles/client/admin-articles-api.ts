"use client";

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
    | { article?: unknown; versionId?: string; error?: AdminApiError }
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

export const adminArticlesApi = {
  create(body: Record<string, unknown>) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      "/api/admin/articles",
      "POST",
      body,
    );
  },
  updateMetadata(articleId: string, body: Record<string, unknown>) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      `/api/admin/articles/${articleId}/metadata`,
      "PATCH",
      body,
    );
  },
  updateBlocks(articleId: string, body: Record<string, unknown>) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      `/api/admin/articles/${articleId}/blocks`,
      "PUT",
      body,
    );
  },
  publish(articleId: string, body: Record<string, unknown>) {
    return mutate<{
      article: import("../admin-article-dto").AdminArticleDto;
      versionId: string;
    }>(`/api/admin/articles/${articleId}/publish`, "POST", body);
  },
  hide(articleId: string, expectedRevision: number) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      `/api/admin/articles/${articleId}/hide`,
      "POST",
      { expectedRevision },
    );
  },
  archive(articleId: string, expectedRevision: number) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      `/api/admin/articles/${articleId}/archive`,
      "POST",
      { expectedRevision },
    );
  },
  restoreArchive(articleId: string, expectedRevision: number) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      `/api/admin/articles/${articleId}/restore`,
      "POST",
      { expectedRevision },
    );
  },
  restoreVersion(
    articleId: string,
    versionId: string,
    expectedRevision: number,
    changeSummary?: string,
  ) {
    return mutate<{ article: import("../admin-article-dto").AdminArticleDto }>(
      `/api/admin/articles/${articleId}/versions/${versionId}/restore`,
      "POST",
      { expectedRevision, changeSummary },
    );
  },
};
