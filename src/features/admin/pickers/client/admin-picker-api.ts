"use client";

import type { PickerMaterialItem, PickerMediaItem } from "../picker-types";
import { isAbortError } from "../picker-types";

export class AdminPickerClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AdminPickerClientError";
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", signal });
  const json = (await res.json().catch(() => null)) as
    | (T & { error?: { code?: string; message?: string } })
    | null;
  if (!res.ok) {
    throw new AdminPickerClientError(
      json?.error?.code ?? "INTERNAL_ERROR",
      json?.error?.message ?? "Ошибка запроса",
      res.status,
    );
  }
  return json as T;
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export const adminPickerApi = {
  searchMedia(
    input: { q?: string; kind?: "image" | "document"; limit?: number },
    signal?: AbortSignal,
  ) {
    return getJson<{ items: PickerMediaItem[]; scanLimitExceeded: boolean }>(
      `/api/admin/pickers/media${qs({
        q: input.q,
        kind: input.kind,
        limit: input.limit != null ? String(input.limit) : undefined,
      })}`,
      signal,
    );
  },
  lookupMedia(ids: readonly string[], signal?: AbortSignal) {
    if (ids.length === 0) {
      return Promise.resolve({ items: [] as PickerMediaItem[], scanLimitExceeded: false });
    }
    return getJson<{ items: PickerMediaItem[]; scanLimitExceeded: boolean }>(
      `/api/admin/pickers/media${qs({ ids: ids.join(",") })}`,
      signal,
    );
  },
  searchMaterials(
    input: {
      entityType: "article" | "prompt";
      q?: string;
      excludeId?: string;
      excludeIds?: readonly string[];
      limit?: number;
    },
    signal?: AbortSignal,
  ) {
    return getJson<{ items: PickerMaterialItem[]; scanLimitExceeded: boolean }>(
      `/api/admin/pickers/materials${qs({
        type: input.entityType,
        q: input.q,
        excludeId: input.excludeId,
        excludeIds: input.excludeIds?.join(","),
        limit: input.limit != null ? String(input.limit) : undefined,
      })}`,
      signal,
    );
  },
  lookupMaterials(
    input: {
      articleIds?: readonly string[];
      promptIds?: readonly string[];
    },
    signal?: AbortSignal,
  ) {
    const articleIds = input.articleIds ?? [];
    const promptIds = input.promptIds ?? [];
    if (articleIds.length === 0 && promptIds.length === 0) {
      return Promise.resolve({
        items: [] as PickerMaterialItem[],
        scanLimitExceeded: false,
      });
    }
    return getJson<{ items: PickerMaterialItem[]; scanLimitExceeded: boolean }>(
      `/api/admin/pickers/materials${qs({
        articleIds: articleIds.join(",") || undefined,
        promptIds: promptIds.join(",") || undefined,
      })}`,
      signal,
    );
  },
};

export { isAbortError };
