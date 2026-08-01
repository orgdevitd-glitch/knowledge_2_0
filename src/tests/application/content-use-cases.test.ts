import { describe, expect, it } from "vitest";

import {
  archiveArticle,
  createArticleUseCase,
  hideArticle,
  listArticles,
  publishArticle,
  reorderArticleBlocks,
  replaceArticleBlocks,
  restoreArchivedArticle,
  restoreArticleVersion,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import {
  createPromptUseCase,
  publishPrompt,
} from "@/features/content/application/prompt-use-cases";
import {
  createVideoUseCase,
  publishVideo,
} from "@/features/content/application/video-use-cases";
import {
  createAudienceUseCase,
  createCategoryUseCase,
  createTagUseCase,
  moveCategoryUseCase,
} from "@/features/content/application/taxonomy-use-cases";
import {
  ConflictError,
  InvalidStatusTransitionError,
  DuplicateTitleError,
  ValidationError,
} from "@/domain/shared/errors";
import {
  createTestPorts,
  headingBlock,
  paragraphBlock,
  testCtx,
} from "../builders/content";

describe("article use cases", () => {
  it("creates draft, publishes versions, hides, archives, restores", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();

    const created = await createArticleUseCase(ports, ctx, {
      slug: "guide",
      title: "Guide",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1"), headingBlock("h1")],
    });
    expect(created.status).toBe("draft");

    const events = await ports.auditRepo.listByEntity("article", created.id);
    expect(events[0]?.eventType).toBe("content.created");
    expect(events[0]?.metadata).not.toHaveProperty("snapshot");
    expect(events[0]?.actorId).toBe("user_1");

    await expect(
      publishArticle(ports, ctx, created.id, created.revision),
    ).resolves.toMatchObject({
      article: { status: "published", publishedVersion: expect.any(String) },
    });

    const afterPublish = await ports.articles.getById(created.id);
    expect(afterPublish?.publishedAt).toBeTruthy();
    const v1 = await ports.versions.getLatestByEntity("article", created.id);
    expect(v1?.versionNumber).toBe(1);

    const updated = await replaceArticleBlocks(
      ports,
      ctx,
      created.id,
      afterPublish!.revision,
      [headingBlock("h1"), paragraphBlock("p1"), paragraphBlock("p2")],
    );

    const pub2 = await publishArticle(ports, ctx, created.id, updated.revision);
    const versions = await ports.versions.listByEntity("article", created.id);
    expect(versions).toHaveLength(2);
    expect(pub2.article.publishedVersion).toBe(versions[1]?.id);

    const hidden = await hideArticle(
      ports,
      ctx,
      created.id,
      pub2.article.revision,
    );
    expect(hidden.status).toBe("hidden");
    expect(hidden.publishedVersion).toBe(pub2.article.publishedVersion);

    const republished = await publishArticle(
      ports,
      ctx,
      created.id,
      hidden.revision,
    );
    expect(republished.article.status).toBe("published");

    const archived = await archiveArticle(
      ports,
      ctx,
      created.id,
      republished.article.revision,
    );
    expect(archived.status).toBe("archived");
    const history = await ports.versions.listByEntity("article", created.id);
    expect(history.length).toBeGreaterThanOrEqual(2);

    const restored = await restoreArchivedArticle(
      ports,
      ctx,
      created.id,
      archived.revision,
    );
    expect(restored.status).toBe("draft");
    expect(restored.publishedAt).toBeNull();

    const fromVersion = await restoreArticleVersion(
      ports,
      ctx,
      created.id,
      versions[0]!.id,
      restored.revision,
    );
    expect(fromVersion.status).toBe("draft");
    expect(fromVersion.blocks).toHaveLength(2);

    await expect(
      hideArticle(ports, ctx, created.id, fromVersion.revision),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it("rejects publish without blocks and concurrency conflicts", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const empty = await createArticleUseCase(ports, ctx, {
      slug: "empty",
      title: "Empty",
      ownerId: "user_1",
    });
    await expect(
      publishArticle(ports, ctx, empty.id, empty.revision),
    ).rejects.toBeInstanceOf(ValidationError);

    const article = await createArticleUseCase(ports, ctx, {
      slug: "race",
      title: "Race",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    await updateArticleMetadata(ports, ctx, article.id, article.revision, {
      title: "Race 2",
    });
    await expect(
      updateArticleMetadata(ports, ctx, article.id, article.revision, {
        title: "Race 3",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("reorder keeps block ids", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const article = await createArticleUseCase(ports, ctx, {
      slug: "order",
      title: "Order",
      blocks: [paragraphBlock("p1"), headingBlock("h1")],
    });
    const reordered = await reorderArticleBlocks(
      ports,
      ctx,
      article.id,
      article.revision,
      ["h1", "p1"],
    );
    expect(reordered.blocks.map((b) => b.id)).toEqual(["h1", "p1"]);
  });

  it("lists with limit", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    for (let i = 0; i < 3; i += 1) {
      await createArticleUseCase(ports, ctx, {
        slug: `item-${i}`,
        title: `Item ${i}`,
      });
    }
    const page = await listArticles(ports, undefined, { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();
  });
});

describe("prompt and video use cases", () => {
  it("publishes prompt with owner and version", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "prompt-one",
      title: "Prompt",
      promptText: "Write a summary",
      ownerId: "user_1",
      relatedArticleIds: ["a1", "a1"],
    });
    expect(prompt.relatedArticleIds).toEqual(["a1"]);
    const published = await publishPrompt(
      ports,
      ctx,
      prompt.id,
      prompt.revision,
    );
    expect(published.prompt.status).toBe("published");
    expect(published.versionId).toBeTruthy();
  });

  it("publishes video only with source", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const noSource = await createVideoUseCase(ports, ctx, {
      slug: "vid-empty",
      title: "Vid",
      ownerId: "user_1",
    });
    await expect(
      publishVideo(ports, ctx, noSource.id, noSource.revision),
    ).rejects.toBeInstanceOf(ValidationError);

    const video = await createVideoUseCase(ports, ctx, {
      slug: "vid-ok",
      title: "Vid",
      ownerId: "user_1",
      mediaId: "media_1",
    });
    const published = await publishVideo(ports, ctx, video.id, video.revision);
    expect(published.video.status).toBe("published");
  });
});

describe("taxonomy use cases", () => {
  it("manages categories tags audiences as data", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const root = await createCategoryUseCase(ports, ctx, {
      slug: "root",
      title: "Root",
    });
    const child = await createCategoryUseCase(ports, ctx, {
      slug: "child",
      title: "Child",
      parentId: root.id,
    });
    await expect(
      moveCategoryUseCase(ports, ctx, root.id, root.revision, child.id),
    ).rejects.toBeInstanceOf(ValidationError);

    const tag = await createTagUseCase(ports, ctx, {
      slug: "tag-one",
      title: "Tag One",
    });
    await expect(
      createTagUseCase(ports, ctx, { slug: "tag-two", title: "tag one" }),
    ).rejects.toBeInstanceOf(DuplicateTitleError);

    const audience = await createAudienceUseCase(ports, ctx, {
      slug: "newcomers",
      title: "Newcomers",
    });
    expect(audience.slug).toBe("newcomers");
    expect(tag.id).toBeTruthy();
  });
});

describe("memory repository immutability", () => {
  it("returns copies and keeps versions immutable", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const article = await createArticleUseCase(ports, ctx, {
      slug: "copy",
      title: "Copy",
      blocks: [paragraphBlock("p1")],
      ownerId: "user_1",
    });
    const loaded = await ports.articles.getById(article.id);
    (loaded as { title: string }).title = "Mutated";
    const again = await ports.articles.getById(article.id);
    expect(again?.title).toBe("Copy");

    const { versionId } = await publishArticle(
      ports,
      ctx,
      article.id,
      article.revision,
    );
    const version = await ports.versions.getById(versionId);
    await expect(
      ports.versions.saveImmutable(version!),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
