import { createAuditEvent } from "@/domain/content/audit";
import {
  applyArticleVersionSnapshot,
  assertArticlePublishable,
  createArticle,
  markArticleArchived,
  markArticleHidden,
  markArticlePublished,
  markArticleRestoredFromArchive,
  toArticleSnapshot,
  withArticleBlocks,
  withArticleMetadata,
  withReorderedBlocks,
  type Article,
  type ArticleSnapshot,
} from "@/domain/content/article";
import {
  createContentVersion,
  nextVersionNumber,
} from "@/domain/content/versioning";
import { DuplicateSlugError, NotFoundError } from "@/domain/shared/errors";
import { assertStatusTransition } from "@/domain/shared/status";
import type { IsoDateTime } from "@/domain/shared/value-objects";
import type { ContentListFilter, PaginationInput } from "@/server/repositories/interfaces/types";
import type { ContentPorts, UseCaseContext } from "./ports";

function resolveNow(ports: ContentPorts, ctx: UseCaseContext): IsoDateTime {
  return (ctx.now as IsoDateTime | undefined) ?? ports.clock.now();
}

async function audit(
  ports: ContentPorts,
  ctx: UseCaseContext,
  eventType: Parameters<typeof createAuditEvent>[0]["eventType"],
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await ports.audit.append(
    createAuditEvent({
      id: ports.ids.next("audit"),
      eventType,
      entityType: "article",
      entityId,
      actorId: ctx.actorId,
      occurredAt: resolveNow(ports, ctx),
      metadata: { requestId: ctx.requestId, ...metadata },
    }),
  );
}

export async function createArticleUseCase(
  ports: ContentPorts,
  ctx: UseCaseContext,
  input: Omit<Parameters<typeof createArticle>[0], "id" | "now"> & {
    id?: string;
  },
): Promise<Article> {
  const now = resolveNow(ports, ctx);
  const id = input.id ?? ports.ids.next("article");
  if (await ports.articles.existsBySlug(input.slug)) {
    throw new DuplicateSlugError("Article slug already exists", {
      slug: input.slug,
    });
  }
  const article = createArticle({ ...input, id, now });
  const saved = await ports.articles.save(article, { expectedRevision: 0 });
  await audit(ports, ctx, "content.created", saved.id, { slug: saved.slug });
  return saved;
}

export async function updateArticleMetadata(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
  patch: Parameters<typeof withArticleMetadata>[1],
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  if (patch.slug && patch.slug !== existing.slug) {
    if (await ports.articles.existsBySlug(patch.slug, articleId)) {
      throw new DuplicateSlugError("Article slug already exists", {
        slug: patch.slug,
      });
    }
  }
  const now = resolveNow(ports, ctx);
  const updated = withArticleMetadata(existing, patch, now);
  const saved = await ports.articles.save(updated, { expectedRevision });
  await audit(ports, ctx, "content.updated", saved.id, {
    fields: Object.keys(patch),
  });
  return saved;
}

export async function replaceArticleBlocks(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
  blocks: unknown[],
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  const now = resolveNow(ports, ctx);
  const updated = withArticleBlocks(existing, blocks, now);
  const saved = await ports.articles.save(updated, { expectedRevision });
  await audit(ports, ctx, "content.updated", saved.id, {
    change: "replaceBlocks",
    blockCount: saved.blocks.length,
  });
  return saved;
}

export async function reorderArticleBlocks(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
  orderedIds: string[],
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  const now = resolveNow(ports, ctx);
  const updated = withReorderedBlocks(existing, orderedIds, now);
  const saved = await ports.articles.save(updated, { expectedRevision });
  await audit(ports, ctx, "content.updated", saved.id, {
    change: "reorderBlocks",
  });
  return saved;
}

export async function publishArticle(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
  changeSummary?: string,
): Promise<{ article: Article; versionId: string }> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  if (existing.status === "published") {
    // Republish: create next immutable version while remaining published.
  } else {
    assertStatusTransition(existing.status, "published");
  }
  assertArticlePublishable(existing);
  const now = resolveNow(ports, ctx);
  const latest = await ports.versions.getLatestByEntity("article", articleId);
  const versionNumber = nextVersionNumber(
    latest ? latest.versionNumber : null,
  );
  const versionId = ports.ids.next("version");
  const auditId = ports.ids.next("audit");
  const version = createContentVersion({
    id: versionId,
    entityType: "article",
    entityId: articleId,
    versionNumber,
    snapshot: toArticleSnapshot(existing) as unknown as Record<
      string,
      unknown
    >,
    changeSummary: changeSummary ?? null,
    createdBy: ctx.actorId,
    createdAt: now,
  });
  const published = markArticlePublished(existing, version.id, now);
  const auditEvent = createAuditEvent({
    id: auditId,
    eventType: "content.published",
    entityType: "article",
    entityId: articleId,
    actorId: ctx.actorId,
    occurredAt: now,
    metadata: {
      requestId: ctx.requestId,
      versionId: version.id,
      versionNumber,
    },
  });

  if (ports.uow.runAtomicArticlePublish) {
    await ports.uow.runAtomicArticlePublish({
      article: published,
      expectedRevision,
      version,
      audit: auditEvent,
    });
    return { article: published, versionId: version.id };
  }

  return ports.uow.run(async () => {
    await ports.versions.saveImmutable(version);
    const saved = await ports.articles.save(published, { expectedRevision });
    await ports.audit.append(auditEvent);
    return { article: saved, versionId: version.id };
  });
}

export async function hideArticle(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  assertStatusTransition(existing.status, "hidden");
  const now = resolveNow(ports, ctx);
  const saved = await ports.articles.save(
    markArticleHidden(existing, now),
    { expectedRevision },
  );
  await audit(ports, ctx, "content.hidden", saved.id);
  return saved;
}

export async function archiveArticle(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  assertStatusTransition(existing.status, "archived");
  const now = resolveNow(ports, ctx);
  const saved = await ports.articles.save(
    markArticleArchived(existing, now),
    { expectedRevision },
  );
  await audit(ports, ctx, "content.archived", saved.id, {
    publishedVersion: saved.publishedVersion,
  });
  return saved;
}

export async function restoreArchivedArticle(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  expectedRevision: number,
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  assertStatusTransition(existing.status, "draft");
  const now = resolveNow(ports, ctx);
  const saved = await ports.articles.save(
    markArticleRestoredFromArchive(existing, now),
    { expectedRevision },
  );
  await audit(ports, ctx, "content.restored", saved.id);
  return saved;
}

export async function restoreArticleVersion(
  ports: ContentPorts,
  ctx: UseCaseContext,
  articleId: string,
  versionId: string,
  expectedRevision: number,
): Promise<Article> {
  const existing = await ports.articles.getById(articleId);
  if (!existing) {
    throw new NotFoundError("Article not found", { articleId });
  }
  const version = await ports.versions.getById(versionId);
  if (!version || version.entityType !== "article" || version.entityId !== articleId) {
    throw new NotFoundError("Version not found for article", {
      articleId,
      versionId,
    });
  }
  const now = resolveNow(ports, ctx);
  const snapshot = version.snapshot as unknown as ArticleSnapshot;
  const restored = applyArticleVersionSnapshot(existing, snapshot, now);
  const saved = await ports.articles.save(restored, { expectedRevision });
  await audit(ports, ctx, "version.restored", saved.id, {
    versionId,
    versionNumber: version.versionNumber,
  });
  return saved;
}

export async function getArticle(
  ports: ContentPorts,
  articleId: string,
): Promise<Article> {
  const article = await ports.articles.getById(articleId);
  if (!article) {
    throw new NotFoundError("Article not found", { articleId });
  }
  return article;
}

export async function listArticles(
  ports: ContentPorts,
  filter?: ContentListFilter,
  pagination?: PaginationInput,
) {
  return ports.articles.list(filter, pagination);
}
