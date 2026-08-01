import "server-only";

import { CONTENT_LIMITS } from "@/domain/shared/limits";
import { ValidationError } from "@/domain/shared/errors";
import type { ContentPorts } from "@/features/content/application/ports";

export type TaxonomyKind = "category" | "tag" | "audience";

export type TaxonomyUsageKind = "draft" | "published";

export type TaxonomyUsageRef = {
  entityType: "article" | "prompt" | "video";
  entityId: string;
  slug: string;
  title: string;
  status: string;
  relationshipType: "category" | "tag" | "audience";
  /** draft = working entity fields; published = immutable publishedVersion snapshot */
  usageKind: TaxonomyUsageKind;
};

export type TaxonomyUsageSummary = {
  articleCount: number;
  promptCount: number;
  videoCount: number;
  totalCount: number;
  recentUsages: TaxonomyUsageRef[];
  hasPublishedUsage: boolean;
  hasDraftUsage: boolean;
  publishedArticleCount: number;
  publishedPromptCount: number;
  publishedVideoCount: number;
  draftArticleCount: number;
  draftPromptCount: number;
  draftVideoCount: number;
};

export type TaxonomyUsagePage = {
  items: TaxonomyUsageRef[];
  nextCursor: string | null;
  limit: number;
  summary: TaxonomyUsageSummary;
};

type TaxonomyIds = {
  categoryIds: readonly string[];
  tagIds: readonly string[];
  audienceIds: readonly string[];
};

type WorkingEntity = TaxonomyIds & {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedVersion: string | null;
};

function idsMatch(
  entity: TaxonomyIds,
  kind: TaxonomyKind,
  taxonomyId: string,
): boolean {
  if (kind === "category") return entity.categoryIds.includes(taxonomyId);
  if (kind === "tag") return entity.tagIds.includes(taxonomyId);
  return entity.audienceIds.includes(taxonomyId);
}

function snapshotTaxonomyIds(snapshot: unknown): TaxonomyIds | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const obj = snapshot as Record<string, unknown>;
  const asIds = (value: unknown): string[] =>
    Array.isArray(value) ? value.map(String) : [];
  return {
    categoryIds: asIds(obj.categoryIds),
    tagIds: asIds(obj.tagIds),
    audienceIds: asIds(obj.audienceIds),
  };
}

function sortUsages(a: TaxonomyUsageRef, b: TaxonomyUsageRef): number {
  const byTitle = a.title.localeCompare(b.title, "ru");
  if (byTitle !== 0) return byTitle;
  const byType = a.entityType.localeCompare(b.entityType);
  if (byType !== 0) return byType;
  const byId = a.entityId.localeCompare(b.entityId);
  if (byId !== 0) return byId;
  return a.usageKind.localeCompare(b.usageKind);
}

function uniqueEntityCount(
  refs: readonly TaxonomyUsageRef[],
  entityType: TaxonomyUsageRef["entityType"],
): number {
  return new Set(
    refs.filter((r) => r.entityType === entityType).map((r) => r.entityId),
  ).size;
}

async function scanWorkingAndPublished(
  ports: ContentPorts,
  list: (pagination: {
    limit: number;
    cursor: string | null;
  }) => Promise<{ items: WorkingEntity[]; nextCursor: string | null }>,
  kind: TaxonomyKind,
  taxonomyId: string,
  entityType: TaxonomyUsageRef["entityType"],
  relationshipType: TaxonomyUsageRef["relationshipType"],
  refs: TaxonomyUsageRef[],
): Promise<void> {
  let cursor: string | null = null;
  let scanned = 0;
  do {
    const page = await list({
      limit: CONTENT_LIMITS.listMaxLimit,
      cursor,
    });
    scanned += page.items.length;
    for (const item of page.items) {
      // Draft/working usage: always from live working fields (never treat this as published).
      if (idsMatch(item, kind, taxonomyId)) {
        refs.push({
          entityType,
          entityId: item.id,
          slug: item.slug,
          title: item.title,
          status: item.status,
          relationshipType,
          usageKind: "draft",
        });
      }

      // Published usage: only immutable publishedVersion snapshot.
      if (item.publishedVersion) {
        const version = await ports.versions.getById(item.publishedVersion);
        const snapIds = snapshotTaxonomyIds(version?.snapshot);
        if (snapIds && idsMatch(snapIds, kind, taxonomyId)) {
          const snap = version!.snapshot as {
            slug?: string;
            title?: string;
          };
          refs.push({
            entityType,
            entityId: item.id,
            slug: typeof snap.slug === "string" ? snap.slug : item.slug,
            title: typeof snap.title === "string" ? snap.title : item.title,
            status: "published",
            relationshipType,
            usageKind: "published",
          });
        }
      }
    }
    cursor = page.nextCursor;
    if (scanned >= CONTENT_LIMITS.maxTaxonomyUsageScan) {
      break;
    }
  } while (cursor);
}

function buildSummary(refs: TaxonomyUsageRef[]): TaxonomyUsageSummary {
  const draft = refs.filter((r) => r.usageKind === "draft");
  const published = refs.filter((r) => r.usageKind === "published");
  const uniqueKeys = new Set(refs.map((r) => `${r.entityType}:${r.entityId}`));
  return {
    articleCount: uniqueEntityCount(refs, "article"),
    promptCount: uniqueEntityCount(refs, "prompt"),
    videoCount: uniqueEntityCount(refs, "video"),
    totalCount: uniqueKeys.size,
    recentUsages: [...refs].sort(sortUsages).slice(0, 5),
    hasPublishedUsage: published.length > 0,
    hasDraftUsage: draft.length > 0,
    publishedArticleCount: uniqueEntityCount(published, "article"),
    publishedPromptCount: uniqueEntityCount(published, "prompt"),
    publishedVideoCount: uniqueEntityCount(published, "video"),
    draftArticleCount: uniqueEntityCount(draft, "article"),
    draftPromptCount: uniqueEntityCount(draft, "prompt"),
    draftVideoCount: uniqueEntityCount(draft, "video"),
  };
}

export class TaxonomyUsageService {
  constructor(private readonly ports: ContentPorts) {}

  async listUsage(
    kind: TaxonomyKind,
    taxonomyId: string,
    pagination?: { limit?: number; cursor?: string | null },
  ): Promise<TaxonomyUsagePage> {
    const limit = Math.min(
      Math.max(
        pagination?.limit ?? CONTENT_LIMITS.taxonomyUsagePageDefault,
        1,
      ),
      CONTENT_LIMITS.taxonomyUsagePageMax,
    );
    if (
      pagination?.limit !== undefined &&
      (pagination.limit < 1 ||
        pagination.limit > CONTENT_LIMITS.taxonomyUsagePageMax)
    ) {
      throw new ValidationError("Invalid usage page limit", {
        adminCode: "VALIDATION_ERROR",
        limit: pagination.limit,
      });
    }

    const refs: TaxonomyUsageRef[] = [];
    const relationshipType =
      kind === "category" ? "category" : kind === "tag" ? "tag" : "audience";

    await scanWorkingAndPublished(
      this.ports,
      async (p) => {
        const page = await this.ports.articles.list(undefined, p);
        return {
          items: page.items.map((a) => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            status: a.status,
            categoryIds: a.categoryIds,
            tagIds: a.tagIds,
            audienceIds: a.audienceIds,
            publishedVersion: a.publishedVersion
              ? String(a.publishedVersion)
              : null,
          })),
          nextCursor: page.nextCursor,
        };
      },
      kind,
      taxonomyId,
      "article",
      relationshipType,
      refs,
    );
    await scanWorkingAndPublished(
      this.ports,
      async (p) => {
        const page = await this.ports.prompts.list(undefined, p);
        return {
          items: page.items.map((a) => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            status: a.status,
            categoryIds: a.categoryIds,
            tagIds: a.tagIds,
            audienceIds: a.audienceIds,
            publishedVersion: a.publishedVersion
              ? String(a.publishedVersion)
              : null,
          })),
          nextCursor: page.nextCursor,
        };
      },
      kind,
      taxonomyId,
      "prompt",
      relationshipType,
      refs,
    );
    await scanWorkingAndPublished(
      this.ports,
      async (p) => {
        const page = await this.ports.videos.list(undefined, p);
        return {
          items: page.items.map((a) => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            status: a.status,
            categoryIds: a.categoryIds,
            tagIds: a.tagIds,
            audienceIds: a.audienceIds,
            publishedVersion: a.publishedVersion
              ? String(a.publishedVersion)
              : null,
          })),
          nextCursor: page.nextCursor,
        };
      },
      kind,
      taxonomyId,
      "video",
      relationshipType,
      refs,
    );

    refs.sort(sortUsages);
    const summary = buildSummary(refs);

    let start = 0;
    if (pagination?.cursor) {
      const idx = refs.findIndex(
        (r) =>
          `${r.usageKind}:${r.entityType}:${r.entityId}` === pagination.cursor,
      );
      start = idx >= 0 ? idx + 1 : 0;
    }
    const pageItems = refs.slice(start, start + limit);
    const nextCursor =
      start + limit < refs.length
        ? `${pageItems[pageItems.length - 1]!.usageKind}:${pageItems[pageItems.length - 1]!.entityType}:${pageItems[pageItems.length - 1]!.entityId}`
        : null;

    return { items: pageItems, nextCursor, limit, summary };
  }

  async getSummary(
    kind: TaxonomyKind,
    taxonomyId: string,
  ): Promise<TaxonomyUsageSummary> {
    const page = await this.listUsage(kind, taxonomyId, { limit: 1 });
    return page.summary;
  }

  /** True only when an immutable published snapshot references the taxonomy id. */
  async hasPublishedUsage(
    kind: TaxonomyKind,
    taxonomyId: string,
  ): Promise<boolean> {
    const summary = await this.getSummary(kind, taxonomyId);
    return summary.hasPublishedUsage;
  }
}
