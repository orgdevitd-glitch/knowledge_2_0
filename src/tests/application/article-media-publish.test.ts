import { beforeEach, describe, expect, it } from "vitest";

import { resetMediaEnvCacheForTests } from "@/config/media-env";
import {
  createArticleUseCase,
  publishArticle,
  replaceArticleBlocks,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import {
  archiveMedia,
  completeMediaUpload,
  startMediaUpload,
} from "@/features/content/application/media-use-cases";
import { ValidationError } from "@/domain/shared/errors";
import {
  blockFixture,
  createTestPorts,
  paragraphBlock,
  testCtx,
} from "../builders/content";

function minimalJpeg(): Uint8Array {
  const base = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ];
  return new Uint8Array([...base, ...Array(52).fill(0)]);
}

function minimalPdf(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n");
}

async function readyImage(ports: ReturnType<typeof createTestPorts>) {
  const ctx = testCtx();
  const started = await startMediaUpload(ports, ctx, {
    kind: "image",
    title: "Img",
    originalFileName: "cover.jpg",
    declaredSizeBytes: 1024,
  });
  ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
  return completeMediaUpload(
    ports,
    ctx,
    started.media.id as string,
    started.media.revision as number,
  );
}

async function readyDocument(ports: ReturnType<typeof createTestPorts>) {
  const ctx = testCtx();
  const started = await startMediaUpload(ports, ctx, {
    kind: "document",
    title: "Doc",
    originalFileName: "file.pdf",
    declaredSizeBytes: 2048,
  });
  ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalPdf());
  return completeMediaUpload(
    ports,
    ctx,
    started.media.id as string,
    started.media.revision as number,
  );
}

describe("article publish media validation", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    process.env.MEDIA_STORAGE_MODE = "memory";
    resetMediaEnvCacheForTests();
    ports = createTestPorts();
  });

  it("publish fails when coverMediaId is missing media", async () => {
    const article = await createArticleUseCase(ports, ctx, {
      slug: "missing-media",
      title: "Missing",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    const withCover = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: "media_does_not_exist" },
    );
    await expect(
      publishArticle(ports, ctx, withCover.id, withCover.revision),
    ).rejects.toThrow(ValidationError);
  });

  it("publish fails for uploading / failed / archived cover", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Cover",
      originalFileName: "cover.jpg",
      declaredSizeBytes: 1024,
    });
    const article = await createArticleUseCase(ports, ctx, {
      slug: "uploading-cover",
      title: "Gate",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    let withCover = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: started.media.id as string },
    );
    await expect(
      publishArticle(ports, ctx, withCover.id, withCover.revision),
    ).rejects.toThrow(ValidationError);

    await expect(
      completeMediaUpload(
        ports,
        ctx,
        started.media.id as string,
        started.media.revision as number,
      ),
    ).rejects.toThrow();
    const failed = await ports.mediaRepo.getById(started.media.id as string);
    withCover = await updateArticleMetadata(
      ports,
      ctx,
      withCover.id,
      withCover.revision,
      { coverMediaId: failed!.id as string },
    );
    await expect(
      publishArticle(ports, ctx, withCover.id, withCover.revision),
    ).rejects.toThrow(ValidationError);

    const ready = await readyImage(ports);
    withCover = await updateArticleMetadata(
      ports,
      ctx,
      withCover.id,
      withCover.revision,
      { coverMediaId: ready.id as string },
    );
    // Archive after removing refs from working draft is not the point —
    // temporarily clear cover to archive, then reattach archived id.
    const cleared = await updateArticleMetadata(
      ports,
      ctx,
      withCover.id,
      withCover.revision,
      { coverMediaId: null },
    );
    const archived = await archiveMedia(
      ports,
      ctx,
      ready.id as string,
      ready.revision as number,
    );
    const withArchived = await updateArticleMetadata(
      ports,
      ctx,
      cleared.id,
      cleared.revision,
      { coverMediaId: archived.id as string },
    );
    await expect(
      publishArticle(ports, ctx, withArchived.id, withArchived.revision),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects wrong kinds for image/file/gallery/cover", async () => {
    const image = await readyImage(ports);
    const doc = await readyDocument(ports);

    let article = await createArticleUseCase(ports, ctx, {
      slug: "kind-gate",
      title: "Kinds",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });

    article = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: doc.id as string },
    );
    await expect(
      publishArticle(ports, ctx, article.id, article.revision),
    ).rejects.toThrow(ValidationError);

    article = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: null },
    );

    article = await replaceArticleBlocks(ports, ctx, article.id, article.revision, [
      blockFixture("image", "img1", {
        mediaId: doc.id as string,
        alt: "x",
        decorative: false,
      }),
    ]);
    await expect(
      publishArticle(ports, ctx, article.id, article.revision),
    ).rejects.toThrow(ValidationError);

    article = await replaceArticleBlocks(ports, ctx, article.id, article.revision, [
      blockFixture("file", "f1", {
        mediaId: image.id as string,
        title: "f",
      }),
    ]);
    await expect(
      publishArticle(ports, ctx, article.id, article.revision),
    ).rejects.toThrow(ValidationError);

    const image2 = await readyImage(ports);
    article = await replaceArticleBlocks(ports, ctx, article.id, article.revision, [
      blockFixture("gallery", "g1", {
        items: [
          { mediaId: doc.id as string, alt: "a", decorative: false },
          { mediaId: image2.id as string, alt: "b", decorative: false },
        ],
      }),
    ]);
    await expect(
      publishArticle(ports, ctx, article.id, article.revision),
    ).rejects.toThrow(ValidationError);
  });

  it("publish succeeds when all media refs are ready with correct kinds", async () => {
    const image = await readyImage(ports);
    const image2 = await readyImage(ports);
    const doc = await readyDocument(ports);
    let article = await createArticleUseCase(ports, ctx, {
      slug: "media-ok",
      title: "OK",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    article = await replaceArticleBlocks(ports, ctx, article.id, article.revision, [
      blockFixture("image", "img1", {
        mediaId: image.id as string,
        alt: "alt",
        decorative: false,
      }),
      blockFixture("file", "f1", {
        mediaId: doc.id as string,
        title: "Doc",
      }),
      blockFixture("gallery", "g1", {
        items: [
          { mediaId: image.id as string, alt: "g", decorative: false },
          { mediaId: image2.id as string, alt: "g2", decorative: false },
        ],
      }),
    ]);
    article = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: image.id as string },
    );
    const result = await publishArticle(
      ports,
      ctx,
      article.id,
      article.revision,
    );
    expect(result.article.status).toBe("published");
    expect(result.article.publishedVersion).toBeTruthy();
  });

  it("draft save allows temporarily non-ready mediaId", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Draft cover",
      originalFileName: "cover.jpg",
      declaredSizeBytes: 1024,
    });
    const article = await createArticleUseCase(ports, ctx, {
      slug: "draft-media",
      title: "Draft",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    const saved = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: started.media.id as string },
    );
    expect(saved.coverMediaId).toBe(started.media.id);
    expect(saved.status).not.toBe("published");
  });

  it("published snapshot mediaId blocks archive after working draft clears cover", async () => {
    const image = await readyImage(ports);
    const article = await createArticleUseCase(ports, ctx, {
      slug: "published-ref",
      title: "Pub",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    const withCover = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: image.id as string },
    );
    const published = await publishArticle(
      ports,
      ctx,
      withCover.id,
      withCover.revision,
    );
    expect(published.article.publishedVersion).toBeTruthy();

    const cleared = await updateArticleMetadata(
      ports,
      ctx,
      published.article.id,
      published.article.revision,
      { coverMediaId: null },
    );
    expect(cleared.coverMediaId).toBeNull();

    await expect(
      archiveMedia(ports, ctx, image.id as string, image.revision as number),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ adminCode: "MEDIA_IN_USE" }),
    });

    // Republish without mediaId unlocks archive.
    const republished = await publishArticle(
      ports,
      ctx,
      cleared.id,
      cleared.revision,
    );
    const archived = await archiveMedia(
      ports,
      ctx,
      image.id as string,
      image.revision as number,
    );
    expect(archived.status).toBe("archived");
    expect(republished.article.publishedVersion).toBeTruthy();
  });

  it("public published snapshot keeps coverMediaId from published version", async () => {
    const image = await readyImage(ports);
    const article = await createArticleUseCase(ports, ctx, {
      slug: "snapshot-media",
      title: "Snap",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    const withCover = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: image.id as string },
    );
    const published = await publishArticle(
      ports,
      ctx,
      withCover.id,
      withCover.revision,
    );
    await updateArticleMetadata(
      ports,
      ctx,
      published.article.id,
      published.article.revision,
      { coverMediaId: null },
    );
    const version = await ports.versionRepo.getById(
      published.article.publishedVersion!,
    );
    expect(version).toBeTruthy();
    const snap = version!.snapshot as { coverMediaId?: string | null };
    expect(snap.coverMediaId).toBe(image.id);
  });
});
