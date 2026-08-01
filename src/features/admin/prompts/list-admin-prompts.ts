import "server-only";

import type { SourceType } from "@/domain/content/source";
import type { ContentStatus } from "@/domain/shared/status";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import type { AdminPrincipal } from "@/server/auth/principal";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import { getContentPorts } from "@/server/composition/content-ports";
import type { PromptAdminSort } from "@/server/repositories/interfaces/prompt-repository";

export type AdminPromptSummary = {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  revision: number;
  sourceType: string;
  currentVersion: string | null;
  publishedVersion: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  reviewDueAt: string | null;
};

export type AdminPromptsDashboard = {
  total: number | null;
  draft: number | null;
  published: number | null;
  hidden: number | null;
  archived: number | null;
  imported: number | null;
  manual: number | null;
  reviewDue: number | null;
  incomplete: boolean;
};

export type AdminPromptsPage = {
  items: AdminPromptSummary[];
  nextCursor: string | null;
  limit: number;
  scanLimitExceeded: boolean;
  persistenceMode: "memory" | "firestore" | "unavailable";
  dashboard: AdminPromptsDashboard;
  sort: PromptAdminSort;
};

function toSummary(p: {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  revision: number;
  source: { type: string };
  currentVersion: string | null;
  publishedVersion: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  reviewDueAt: string | null;
}): AdminPromptSummary {
  return {
    id: p.id as string,
    slug: p.slug as string,
    title: p.title as string,
    status: p.status,
    revision: p.revision as number,
    sourceType: p.source.type,
    currentVersion: (p.currentVersion as string | null) ?? null,
    publishedVersion: (p.publishedVersion as string | null) ?? null,
    createdAt: p.createdAt as string,
    updatedAt: p.updatedAt as string,
    publishedAt: (p.publishedAt as string | null) ?? null,
    reviewDueAt: (p.reviewDueAt as string | null) ?? null,
  };
}

function mapUiSort(sort: string | null | undefined): PromptAdminSort {
  if (sort === "title-asc") return "title_asc";
  if (sort === "created-desc") return "createdAt_desc";
  return "updatedAt_desc";
}

export async function listAdminPrompts(
  _principal: AdminPrincipal,
  input: {
    status?: string | null;
    q?: string | null;
    category?: string | null;
    tag?: string | null;
    audience?: string | null;
    sourceType?: string | null;
    cursor?: string | null;
    sort?: string | null;
    limit?: string | number | null;
  },
): Promise<AdminPromptsPage> {
  const emptyDashboard: AdminPromptsDashboard = {
    total: 0,
    draft: 0,
    published: 0,
    hidden: 0,
    archived: 0,
    imported: 0,
    manual: 0,
    reviewDue: 0,
    incomplete: false,
  };

  const persistence = getAdminPersistence();
  if (persistence.mode === "unavailable") {
    return {
      items: [],
      nextCursor: null,
      limit: CONTENT_LIMITS.adminPromptPageDefault,
      scanLimitExceeded: false,
      persistenceMode: "unavailable",
      dashboard: emptyDashboard,
      sort: "updatedAt_desc",
    };
  }

  const ports = getContentPorts();
  const sort = mapUiSort(input.sort);
  const limitRaw = Number.parseInt(String(input.limit ?? CONTENT_LIMITS.adminPromptPageDefault), 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, CONTENT_LIMITS.adminPromptPageMax)
      : CONTENT_LIMITS.adminPromptPageDefault;

  let sourceType: SourceType | undefined;
  if (input.sourceType === "google-sheets") sourceType = "google-sheets";
  else if (input.sourceType === "portal") sourceType = "portal";
  else if (input.sourceType === "manual") sourceType = "manual-import";

  const status =
    input.status &&
    ["draft", "published", "hidden", "archived"].includes(input.status)
      ? (input.status as ContentStatus)
      : undefined;

  // Honest filter: at most one taxonomy dimension.
  const taxonomyCount = [input.category, input.tag, input.audience].filter(
    Boolean,
  ).length;
  if (taxonomyCount > 1) {
    return {
      items: [],
      nextCursor: null,
      limit,
      scanLimitExceeded: false,
      persistenceMode: persistence.mode,
      dashboard: { ...emptyDashboard, incomplete: true },
      sort,
    };
  }

  const page = await ports.prompts.listAdmin(
    {
      status,
      sourceType,
      categoryId: input.category ?? undefined,
      tagId: input.tag ?? undefined,
      audienceId: input.audience ?? undefined,
      q: input.q?.trim() || undefined,
      sort,
    },
    { limit, cursor: input.cursor ?? null },
  );

  // Dashboard: page-local counts only when scan/search is bounded; otherwise mark incomplete.
  const summaries = page.items.map(toSummary);
  const dashboard: AdminPromptsDashboard = {
    total: null,
    draft: null,
    published: null,
    hidden: null,
    archived: null,
    imported: null,
    manual: null,
    reviewDue: null,
    incomplete: true,
  };
  if (!input.q && !page.scanLimitExceeded) {
    // Provide counts for the current result page only as a hint, not catalog totals.
    dashboard.total = summaries.length;
    dashboard.draft = summaries.filter((i) => i.status === "draft").length;
    dashboard.published = summaries.filter((i) => i.status === "published").length;
    dashboard.hidden = summaries.filter((i) => i.status === "hidden").length;
    dashboard.archived = summaries.filter((i) => i.status === "archived").length;
    dashboard.imported = summaries.filter(
      (i) => i.sourceType === "google-sheets",
    ).length;
    dashboard.manual = summaries.filter(
      (i) => i.sourceType === "portal" || i.sourceType === "manual-import",
    ).length;
    dashboard.reviewDue = summaries.filter(
      (i) => i.reviewDueAt != null && i.status !== "archived",
    ).length;
    dashboard.incomplete = Boolean(page.nextCursor);
  }

  return {
    items: summaries,
    nextCursor: page.nextCursor,
    limit: page.limit,
    scanLimitExceeded: page.scanLimitExceeded,
    persistenceMode: persistence.mode,
    dashboard,
    sort,
  };
}
