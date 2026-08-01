import "server-only";

import type { AdminPrincipal } from "@/server/auth/principal";
import { getContentPorts, isContentPersistenceAvailable } from "@/server/composition/content-ports";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import { toAdminArticleDto, type AdminArticleDto } from "./admin-article-dto";
import { NotFoundError } from "@/domain/shared/errors";
import type { ContentStatus } from "@/domain/shared/status";
import {
  canPublishFromStatus,
  canTransitionStatus,
} from "@/domain/shared/status";

export type AdminTaxonomyOption = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

export type AdminVersionSummary = {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  changeSummary: string | null;
  isPublishedVersion: boolean;
};

export type AdminAuditSummary = {
  id: string;
  eventType: string;
  occurredAt: string;
  actorId: string;
  changeSummary: string | null;
};

export type AdminArticleActions = {
  canEdit: boolean;
  canPreview: boolean;
  canPublish: boolean;
  canHide: boolean;
  canArchive: boolean;
  canRestoreArchive: boolean;
  canViewVersions: boolean;
  canOpenPublic: boolean;
};

export function actionsForStatus(status: ContentStatus): AdminArticleActions {
  return {
    canEdit: status !== "archived",
    canPreview: true,
    canPublish: canPublishFromStatus(status),
    canHide: canTransitionStatus(status, "hidden"),
    canArchive: canTransitionStatus(status, "archived"),
    canRestoreArchive: canTransitionStatus(status, "draft") && status === "archived",
    canViewVersions: true,
    canOpenPublic: status === "published",
  };
}

export async function getAdminArticleDetail(
  _principal: AdminPrincipal,
  articleId: string,
): Promise<{
  article: AdminArticleDto;
  actions: AdminArticleActions;
  recentAudit: AdminAuditSummary[];
} | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const article = await ports.articles.getById(articleId);
  if (!article) return null;
  const persistence = getAdminPersistence();
  const events = persistence.audit
    ? await persistence.audit.listByEntity("article", articleId)
    : [];
  const recentAudit = events
    .slice()
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, 20)
    .map((e) => ({
      id: e.id as string,
      eventType: e.eventType,
      occurredAt: e.occurredAt as string,
      actorId: e.actorId as string,
      changeSummary:
        typeof e.metadata?.changeSummary === "string"
          ? e.metadata.changeSummary
          : null,
    }));
  return {
    article: toAdminArticleDto(article),
    actions: actionsForStatus(article.status),
    recentAudit,
  };
}

export async function listAdminVersions(
  _principal: AdminPrincipal,
  articleId: string,
  page = 1,
  pageSize = 20,
): Promise<{
  articleTitle: string;
  publishedVersion: string | null;
  items: AdminVersionSummary[];
  total: number;
  page: number;
  totalPages: number;
} | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const article = await ports.articles.getById(articleId);
  if (!article) return null;
  const versions = await ports.versions.listByEntity("article", articleId);
  const sorted = versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const publishedVersion = article.publishedVersion
    ? String(article.publishedVersion)
    : null;
  return {
    articleTitle: article.title as string,
    publishedVersion,
    items: sorted.slice(start, start + pageSize).map((v) => ({
      id: v.id as string,
      versionNumber: v.versionNumber as number,
      createdAt: v.createdAt as string,
      createdBy: v.createdBy as string,
      changeSummary: v.changeSummary,
      isPublishedVersion: publishedVersion === String(v.id),
    })),
    total,
    page: safePage,
    totalPages,
  };
}

export async function getAdminVersionDetail(
  _principal: AdminPrincipal,
  articleId: string,
  versionId: string,
) {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const article = await ports.articles.getById(articleId);
  if (!article) return null;
  const version = await ports.versions.getById(versionId);
  if (
    !version ||
    version.entityType !== "article" ||
    version.entityId !== articleId
  ) {
    return null;
  }
  return {
    article: toAdminArticleDto(article),
    version: {
      id: version.id as string,
      versionNumber: version.versionNumber as number,
      createdAt: version.createdAt as string,
      createdBy: version.createdBy as string,
      changeSummary: version.changeSummary,
      snapshot: version.snapshot,
      isPublishedVersion:
        article.publishedVersion != null &&
        String(article.publishedVersion) === String(version.id),
    },
    actions: actionsForStatus(article.status),
  };
}

export async function listAdminTaxonomyOptions(): Promise<{
  categories: AdminTaxonomyOption[];
  tags: AdminTaxonomyOption[];
  audiences: AdminTaxonomyOption[];
}> {
  if (!isContentPersistenceAvailable()) {
    return { categories: [], tags: [], audiences: [] };
  }
  const ports = getContentPorts();
  const [categories, tags, audiences] = await Promise.all([
    ports.categories.listAll(),
    ports.tags.listAll(),
    ports.audiences.listAll(),
  ]);
  const map = (
    items: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
    }>,
    selectedIds: readonly string[] = [],
  ): AdminTaxonomyOption[] =>
    items
      .filter(
        (i) => i.status === "active" || selectedIds.includes(i.id as string),
      )
      .map((i) => ({
        id: i.id as string,
        slug: i.slug as string,
        title: i.title as string,
        status: i.status,
      }));
  // Callers that need linked archived values should pass selected ids via
  // listAdminTaxonomyOptionsForArticle. Default export stays active-only.
  return {
    categories: map(categories),
    tags: map(tags),
    audiences: map(audiences),
  };
}

/** Active values plus currently linked archived values for editor display. */
export async function listAdminTaxonomyOptionsForArticle(selected: {
  categoryIds: readonly string[];
  tagIds: readonly string[];
  audienceIds: readonly string[];
}): Promise<{
  categories: AdminTaxonomyOption[];
  tags: AdminTaxonomyOption[];
  audiences: AdminTaxonomyOption[];
}> {
  if (!isContentPersistenceAvailable()) {
    return { categories: [], tags: [], audiences: [] };
  }
  const ports = getContentPorts();
  const [categories, tags, audiences] = await Promise.all([
    ports.categories.listAll(),
    ports.tags.listAll(),
    ports.audiences.listAll(),
  ]);
  const map = (
    items: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
    }>,
    selectedIds: readonly string[],
  ): AdminTaxonomyOption[] =>
    items
      .filter(
        (i) => i.status === "active" || selectedIds.includes(i.id as string),
      )
      .map((i) => ({
        id: i.id as string,
        slug: i.slug as string,
        title: i.title as string,
        status: i.status,
      }));
  return {
    categories: map(categories, selected.categoryIds),
    tags: map(tags, selected.tagIds),
    audiences: map(audiences, selected.audienceIds),
  };
}

export async function requireAdminArticle(
  principal: AdminPrincipal,
  articleId: string,
): Promise<AdminArticleDto> {
  const detail = await getAdminArticleDetail(principal, articleId);
  if (!detail) {
    throw new NotFoundError("Article not found", { articleId });
  }
  return detail.article;
}
