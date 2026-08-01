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
    | { prompt?: unknown; versionId?: string; error?: AdminApiError }
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

export const adminPromptsApi = {
  create(body: Record<string, unknown>) {
    return mutate<{ prompt: import("../admin-prompt-dto").AdminPromptDto }>(
      "/api/admin/prompts",
      "POST",
      body,
    );
  },
  update(promptId: string, body: Record<string, unknown>) {
    return mutate<{ prompt: import("../admin-prompt-dto").AdminPromptDto }>(
      `/api/admin/prompts/${promptId}`,
      "PATCH",
      body,
    );
  },
  publish(promptId: string, body: Record<string, unknown>) {
    return mutate<{
      prompt: import("../admin-prompt-dto").AdminPromptDto;
      versionId: string;
    }>(`/api/admin/prompts/${promptId}/publish`, "POST", body);
  },
  hide(promptId: string, expectedRevision: number) {
    return mutate<{ prompt: import("../admin-prompt-dto").AdminPromptDto }>(
      `/api/admin/prompts/${promptId}/hide`,
      "POST",
      { expectedRevision },
    );
  },
  archive(promptId: string, expectedRevision: number) {
    return mutate<{ prompt: import("../admin-prompt-dto").AdminPromptDto }>(
      `/api/admin/prompts/${promptId}/archive`,
      "POST",
      { expectedRevision },
    );
  },
  restoreArchive(promptId: string, expectedRevision: number) {
    return mutate<{ prompt: import("../admin-prompt-dto").AdminPromptDto }>(
      `/api/admin/prompts/${promptId}/restore`,
      "POST",
      { expectedRevision },
    );
  },
  restoreVersion(
    promptId: string,
    versionId: string,
    expectedRevision: number,
    changeSummary?: string,
  ) {
    return mutate<{ prompt: import("../admin-prompt-dto").AdminPromptDto }>(
      `/api/admin/prompts/${promptId}/versions/${versionId}/restore`,
      "POST",
      { expectedRevision, changeSummary },
    );
  },
};
