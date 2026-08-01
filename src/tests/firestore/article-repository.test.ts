/**
 * Firestore integration tests — require Emulator.
 * Run via: npm run test:firestore
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(Boolean(emulatorHost))("Firestore article repository", () => {
  beforeAll(() => {
    process.env.FIREBASE_PROJECT_ID =
      process.env.FIREBASE_PROJECT_ID ?? "demo-ckp";
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.AUTH_MODE = "disabled";
    process.env.PERSISTENCE_MODE = "firestore";
  });

  beforeEach(async () => {
    const { resetServerEnvCacheForTests } = await import("@/config/env");
    const { resetFirebaseAdminCacheForTests } = await import(
      "@/server/firebase/admin"
    );
    resetServerEnvCacheForTests();
    resetFirebaseAdminCacheForTests();

    const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-ckp";
    await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
  });

  afterAll(async () => {
    const { resetServerEnvCacheForTests } = await import("@/config/env");
    resetServerEnvCacheForTests();
  });

  it(
    "creates reads updates and conflicts on stale revision",
    async () => {
    const { createArticle, withArticleMetadata } = await import(
      "@/domain/content/article"
    );
    const { parseIsoDateTime } = await import("@/domain/shared/value-objects");
    const { FirestoreArticleRepository } = await import(
      "@/server/repositories/firestore/firestore-article-repository"
    );
    const { ConflictError, DuplicateSlugError } = await import(
      "@/domain/shared/errors"
    );

    const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
    const repo = new FirestoreArticleRepository();
    const article = createArticle({
      id: "a1",
      slug: "hello",
      title: "Hello",
      ownerId: "u1",
      now,
    });

    await repo.save(article, { expectedRevision: 0 });
    const loaded = await repo.getById("a1");
    expect(loaded?.title).toBe("Hello");
    expect(await repo.getBySlug("hello")).not.toBeNull();

    const next = withArticleMetadata(loaded!, { title: "Hello 2" }, now);
    await repo.save(next, { expectedRevision: loaded!.revision });

    await expect(
      repo.save(next, { expectedRevision: 0 }),
    ).rejects.toBeInstanceOf(ConflictError);

    const other = createArticle({
      id: "a2",
      slug: "hello",
      title: "Dup",
      now,
    });
    await expect(
      repo.save(other, { expectedRevision: 0 }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);

    const page = await repo.list(undefined, { limit: 10 });
    expect(page.items.length).toBeGreaterThanOrEqual(1);
  },
  20_000,
  );

  it("atomic publish creates article version and audit together", async () => {
    const { createArticle, markArticlePublished, toArticleSnapshot } =
      await import("@/domain/content/article");
    const { createContentVersion } = await import(
      "@/domain/content/versioning"
    );
    const { createAuditEvent } = await import("@/domain/content/audit");
    const { parseIsoDateTime } = await import("@/domain/shared/value-objects");
    const { richTextFromPlain } = await import("@/domain/shared/rich-text");
    const { BLOCK_SCHEMA_VERSION } = await import("@/domain/content/blocks");
    const { FirestoreArticleRepository } = await import(
      "@/server/repositories/firestore/firestore-article-repository"
    );
    const { FirestoreVersionRepository } = await import(
      "@/server/repositories/firestore/firestore-version-repository"
    );
    const { FirestoreAuditRepository } = await import(
      "@/server/repositories/firestore/firestore-audit-repository"
    );
    const { FirestoreUnitOfWork } = await import(
      "@/server/repositories/firestore/firestore-unit-of-work"
    );

    const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
    const block = {
      id: "b1",
      type: "paragraph" as const,
      schemaVersion: BLOCK_SCHEMA_VERSION,
      settings: {},
      visibility: "all" as const,
      data: { content: richTextFromPlain("Hi") },
    };

    const articleRepo = new FirestoreArticleRepository();
    const versionRepo = new FirestoreVersionRepository();
    const auditRepo = new FirestoreAuditRepository();
    const uow = new FirestoreUnitOfWork();

    const article = createArticle({
      id: "pub1",
      slug: "publish-me",
      title: "Publish me",
      ownerId: "u1",
      blocks: [block],
      now,
    });
    await articleRepo.save(article, { expectedRevision: 0 });

    const version = createContentVersion({
      id: "ver1",
      entityType: "article",
      entityId: "pub1",
      versionNumber: 1,
      snapshot: toArticleSnapshot(article) as unknown as Record<
        string,
        unknown
      >,
      createdBy: "u1",
      createdAt: now,
    });
    const published = markArticlePublished(article, version.id, now);
    const audit = createAuditEvent({
      id: "aud1",
      eventType: "content.published",
      entityType: "article",
      entityId: "pub1",
      actorId: "u1",
      occurredAt: now,
      metadata: { versionId: version.id },
    });

    await uow.runAtomicArticlePublish({
      article: published,
      expectedRevision: article.revision,
      version,
      audit,
    });

    expect(await versionRepo.getById("ver1")).not.toBeNull();
    expect((await auditRepo.listByEntity("article", "pub1")).length).toBe(1);
    expect((await articleRepo.getById("pub1"))?.status).toBe("published");
  });

  it("hides archives and restores via use cases with firestore ports", async () => {
    const { createArticleUseCase, publishArticle, hideArticle, archiveArticle, restoreArchivedArticle } =
      await import("@/features/content/application/article-use-cases");
    const { SystemClock } = await import("@/domain/shared/clock");
    const { SequentialIdGenerator } = await import(
      "@/domain/shared/id-generator"
    );
    const { FirestoreArticleRepository } = await import(
      "@/server/repositories/firestore/firestore-article-repository"
    );
    const { FirestoreVersionRepository } = await import(
      "@/server/repositories/firestore/firestore-version-repository"
    );
    const { FirestoreAuditRepository } = await import(
      "@/server/repositories/firestore/firestore-audit-repository"
    );
    const { FirestoreUnitOfWork } = await import(
      "@/server/repositories/firestore/firestore-unit-of-work"
    );
    const { MemoryPromptRepository, MemoryVideoRepository, MemoryCategoryRepository, MemoryTagRepository, MemoryAudienceRepository } =
      await import("@/server/repositories/memory");
    const { richTextFromPlain } = await import("@/domain/shared/rich-text");
    const { BLOCK_SCHEMA_VERSION } = await import("@/domain/content/blocks");

    const ports = {
      articles: new FirestoreArticleRepository(),
      prompts: new MemoryPromptRepository(),
      videos: new MemoryVideoRepository(),
      categories: new MemoryCategoryRepository(),
      tags: new MemoryTagRepository(),
      audiences: new MemoryAudienceRepository(),
      versions: new FirestoreVersionRepository(),
      audit: new FirestoreAuditRepository(),
      clock: new SystemClock(),
      ids: new SequentialIdGenerator("fs"),
      uow: new FirestoreUnitOfWork(),
    };
    const ctx = { actorId: "admin_1", requestId: "req_fs" };
    const block = {
      id: "b1",
      type: "paragraph" as const,
      schemaVersion: BLOCK_SCHEMA_VERSION,
      settings: {},
      visibility: "all" as const,
      data: { content: richTextFromPlain("Body") },
    };
    const created = await createArticleUseCase(ports, ctx, {
      slug: "life-cycle",
      title: "Lifecycle",
      ownerId: "admin_1",
      blocks: [block],
    });
    const pub = await publishArticle(ports, ctx, created.id, created.revision);
    const hidden = await hideArticle(
      ports,
      ctx,
      created.id,
      pub.article.revision,
    );
    expect(hidden.status).toBe("hidden");
    const archived = await archiveArticle(
      ports,
      ctx,
      created.id,
      hidden.revision,
    );
    expect(archived.status).toBe("archived");
    const restored = await restoreArchivedArticle(
      ports,
      ctx,
      created.id,
      archived.revision,
    );
    expect(restored.status).toBe("draft");
  });
});
