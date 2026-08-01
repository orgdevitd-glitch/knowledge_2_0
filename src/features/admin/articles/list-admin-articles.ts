import "server-only";

import type { AdminPrincipal } from "@/server/auth/principal";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import type { ContentStatus } from "@/domain/shared/status";

export type AdminArticleSummary = {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  revision: number;
  blockCount: number;
  currentVersion: string | null;
  publishedVersion: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  reviewDueAt: string | null;
};

export type AdminArticlesPage = {
  items: AdminArticleSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  persistenceMode: "memory" | "firestore" | "unavailable";
};

const PAGE_SIZE = 20;

export async function listAdminArticles(
  _principal: AdminPrincipal,
  input: {
    status?: string | null;
    q?: string | null;
    page?: string | number | null;
  },
): Promise<AdminArticlesPage> {
  const persistence = getAdminPersistence();
  if (!persistence.articles) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      totalPages: 1,
      persistenceMode: "unavailable",
    };
  }

  const pageRaw = Number.parseInt(String(input.page ?? "1"), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const result = await persistence.articles.list(
    input.status &&
      ["draft", "published", "hidden", "archived"].includes(input.status)
      ? { status: input.status as ContentStatus, sort: "updatedAt_desc" }
      : { sort: "updatedAt_desc" },
    { limit: 100 },
  );

  let items = result.items.map((a) => ({
    id: a.id as string,
    slug: a.slug as string,
    title: a.title as string,
    status: a.status,
    revision: a.revision as number,
    blockCount: a.blocks.length,
    currentVersion: (a.currentVersion as string | null) ?? null,
    publishedVersion: (a.publishedVersion as string | null) ?? null,
    createdAt: a.createdAt as string,
    updatedAt: a.updatedAt as string,
    publishedAt: (a.publishedAt as string | null) ?? null,
    reviewDueAt: (a.reviewDueAt as string | null) ?? null,
  }));

  const q = input.q?.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q),
    );
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
    persistenceMode: persistence.mode,
  };
}
