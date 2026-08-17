import "server-only";

import type { ContentPorts } from "@/features/content/application/ports";
import { isUnsetReferenceId } from "./placeholder-id";
import {
  PICKER_ARTICLE_SCAN_LIMIT,
  PICKER_RESULT_LIMIT,
  clampPickerQuery,
  clampPickerSummary,
} from "./picker-limits";
import type { PickerMaterialItem } from "./picker-types";

export function missingPickerMaterialItem(
  id: string,
  entityType: "article" | "prompt",
): PickerMaterialItem {
  return {
    id,
    title: "",
    entityType,
    status: "missing",
    summary: null,
    selectable: false,
    unavailable: true,
  };
}

export function toPickerArticleItem(article: {
  id: string;
  title: string;
  status: string;
  summary: string | null;
}): PickerMaterialItem {
  const selectable = article.status === "published";
  const unavailable =
    article.status === "archived" || article.status === "missing";
  return {
    id: article.id as string,
    title: article.title as string,
    entityType: "article",
    status: article.status,
    summary: clampPickerSummary(article.summary),
    selectable,
    unavailable,
  };
}

export function toPickerPromptItem(prompt: {
  id: string;
  title: string;
  status: string;
  summary: string | null;
}): PickerMaterialItem {
  const selectable = prompt.status === "published";
  const unavailable =
    prompt.status === "archived" || prompt.status === "missing";
  return {
    id: prompt.id as string,
    title: prompt.title as string,
    entityType: "prompt",
    status: prompt.status,
    summary: clampPickerSummary(prompt.summary),
    selectable,
    unavailable,
  };
}

function exclusionSet(
  excludeId?: string | null,
  excludeIds?: readonly string[] | null,
): Set<string> {
  const blocked = new Set<string>();
  const primary = excludeId?.trim();
  if (primary) blocked.add(primary);
  for (const id of excludeIds ?? []) {
    const trimmed = id.trim();
    if (trimmed) blocked.add(trimmed);
  }
  return blocked;
}

export async function lookupPickerMaterials(
  ports: Pick<ContentPorts, "articles" | "prompts">,
  input: {
    articleIds?: readonly string[];
    promptIds?: readonly string[];
  },
): Promise<PickerMaterialItem[]> {
  const items: PickerMaterialItem[] = [];
  for (const id of input.articleIds ?? []) {
    if (isUnsetReferenceId(id)) {
      items.push(missingPickerMaterialItem(id, "article"));
      continue;
    }
    const article = await ports.articles.getById(id);
    items.push(
      article ? toPickerArticleItem(article) : missingPickerMaterialItem(id, "article"),
    );
  }
  for (const id of input.promptIds ?? []) {
    if (isUnsetReferenceId(id)) {
      items.push(missingPickerMaterialItem(id, "prompt"));
      continue;
    }
    const prompt = await ports.prompts.getById(id);
    items.push(
      prompt ? toPickerPromptItem(prompt) : missingPickerMaterialItem(id, "prompt"),
    );
  }
  return items;
}

export async function searchPickerMaterials(
  ports: Pick<ContentPorts, "articles" | "prompts">,
  input: {
    entityType: "article" | "prompt";
    q?: string | null;
    excludeId?: string | null;
    excludeIds?: readonly string[] | null;
    limit?: number;
  },
): Promise<{ items: PickerMaterialItem[]; scanLimitExceeded: boolean }> {
  const limit = Math.min(input.limit ?? PICKER_RESULT_LIMIT, PICKER_RESULT_LIMIT);
  const q = clampPickerQuery(input.q).toLowerCase();
  const blocked = exclusionSet(input.excludeId, input.excludeIds);

  if (input.entityType === "prompt") {
    const page = await ports.prompts.listAdmin(
      {
        status: "published",
        q: q || undefined,
        sort: "updatedAt_desc",
      },
      { limit, cursor: null },
    );
    const items = page.items
      .filter((p) => p.status === "published")
      .filter((p) => !blocked.has(p.id))
      .map(toPickerPromptItem)
      .slice(0, limit);
    return { items, scanLimitExceeded: page.scanLimitExceeded };
  }

  const page = await ports.articles.list(
    { status: "published", sort: "updatedAt_desc" },
    { limit: q ? PICKER_ARTICLE_SCAN_LIMIT : limit },
  );
  let items = page.items
    .filter((a) => a.status === "published")
    .filter((a) => !blocked.has(a.id));
  if (q) {
    items = items.filter(
      (a) =>
        (a.title as string).toLowerCase().includes(q) ||
        (a.slug as string).toLowerCase().includes(q),
    );
  }
  return {
    items: items.slice(0, limit).map(toPickerArticleItem),
    scanLimitExceeded: Boolean(q && page.items.length >= PICKER_ARTICLE_SCAN_LIMIT),
  };
}
