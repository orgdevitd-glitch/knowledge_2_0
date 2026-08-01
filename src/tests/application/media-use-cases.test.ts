import { beforeEach, describe, expect, it } from "vitest";

import { resetMediaEnvCacheForTests } from "@/config/media-env";
import { toAdminMediaDto } from "@/features/admin/media/admin-media-dto";
import {
  archiveMedia,
  completeMediaUpload,
  retryMediaUpload,
  startMediaUpload,
  updateMediaMetadata,
} from "@/features/content/application/media-use-cases";
import {
  createArticleUseCase,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import { ValidationError } from "@/domain/shared/errors";
import { createTestPorts, paragraphBlock, testCtx } from "../builders/content";

function minimalJpeg(size = 64): Uint8Array {
  const base = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ];
  return new Uint8Array([...base, ...Array(Math.max(0, size - base.length)).fill(0)]);
}

async function uploadReadyImage(
  ports: ReturnType<typeof createTestPorts>,
  ctx: ReturnType<typeof testCtx>,
) {
  const started = await startMediaUpload(ports, ctx, {
    kind: "image",
    title: "Cover",
    originalFileName: "cover.jpg",
    declaredSizeBytes: 1024,
  });
  ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
  const ready = await completeMediaUpload(
    ports,
    ctx,
    started.media.id as string,
    started.media.revision as number,
  );
  return { started, ready };
}

describe("media use cases", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    process.env.MEDIA_STORAGE_MODE = "memory";
    resetMediaEnvCacheForTests();
    ports = createTestPorts();
  });

  it("happy path: start → putViaSignedUrl → complete with minimal JPEG", async () => {
    const { started, ready } = await uploadReadyImage(ports, ctx);
    expect(started.media.status).toBe("uploading");
    expect(ready.status).toBe("ready");
    expect(ready.mimeType).toBe("image/jpeg");
    expect(ready.sizeBytes).toBeGreaterThan(0);

    const events = await ports.auditRepo.listByEntity("media", ready.id);
    expect(events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        "media.created",
        "media.upload.started",
        "media.upload.completed",
      ]),
    );
  });

  it("rejects HTML/unknown content at complete", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Bad",
      originalFileName: "fake.jpg",
      declaredSizeBytes: 512,
    });
    const html = new TextEncoder().encode("<html><body>x</body></html>");
    ports.mediaStorage.putViaSignedUrl(started.uploadUrl, html);
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        started.media.id as string,
        started.media.revision as number,
      ),
    ).rejects.toThrow(ValidationError);

    const live = await ports.mediaRepo.getById(started.media.id as string);
    expect(live?.status).toBe("failed");
  });

  it("retry assigns new storageKey after failure", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Retry me",
      originalFileName: "x.jpg",
      declaredSizeBytes: 512,
    });
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        started.media.id as string,
        started.media.revision as number,
      ),
    ).rejects.toThrow();

    const failed = await ports.mediaRepo.getById(started.media.id as string);
    const oldKey = failed!.storageKey;

    const retried = await retryMediaUpload(
      ports,
      ctx,
      failed!.id as string,
      failed!.revision as number,
    );
    expect(retried.media.status).toBe("uploading");
    expect(retried.media.storageKey).not.toBe(oldKey);
    expect(retried.uploadUrl).toBeTruthy();
  });

  it("archive blocked when article references media", async () => {
    const { ready } = await uploadReadyImage(ports, ctx);
    const article = await createArticleUseCase(ports, ctx, {
      slug: "with-cover",
      title: "Article",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    const withCover = await updateArticleMetadata(
      ports,
      ctx,
      article.id,
      article.revision,
      { coverMediaId: ready.id as string },
    );
    expect(withCover.coverMediaId).toBe(ready.id);

    await expect(
      archiveMedia(ports, ctx, ready.id as string, ready.revision as number),
    ).rejects.toMatchObject({
      name: expect.stringContaining("ValidationError"),
    });
  });

  it("updates metadata on ready media", async () => {
    const { ready } = await uploadReadyImage(ports, ctx);
    const updated = await updateMediaMetadata(
      ports,
      ctx,
      ready.id as string,
      ready.revision as number,
      { title: "Renamed", description: "Desc" },
    );
    expect(updated.title).toBe("Renamed");
    expect(updated.description).toBe("Desc");
  });

  it("public admin DTO omits storageKey", async () => {
    const { ready } = await uploadReadyImage(ports, ctx);
    const dto = toAdminMediaDto(ready);
    expect(dto).not.toHaveProperty("storageKey");
    expect(dto.publicPath).toBe(`/media/${ready.id}`);
    expect(Object.keys(dto)).not.toContain("storageKey");
  });
});
