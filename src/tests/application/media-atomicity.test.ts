import { beforeEach, describe, expect, it } from "vitest";

import { resetMediaEnvCacheForTests } from "@/config/media-env";
import {
  archiveMedia,
  completeMediaUpload,
  startMediaUpload,
  updateMediaMetadata,
} from "@/features/content/application/media-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

function minimalJpeg(): Uint8Array {
  const base = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ];
  return new Uint8Array([...base, ...Array(52).fill(0)]);
}

describe("media atomicity (memory UoW rollback)", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    process.env.MEDIA_STORAGE_MODE = "memory";
    resetMediaEnvCacheForTests();
    ports = createTestPorts();
  });

  it("rolls back create when audit write fails", async () => {
    ports.auditRepo.failNextAppend = new Error("audit fail create");
    await expect(
      startMediaUpload(ports, ctx, {
        kind: "image",
        title: "Atomic",
        originalFileName: "a.jpg",
        declaredSizeBytes: 512,
      }),
    ).rejects.toThrow(/audit fail create/);
    expect(ports.mediaRepo.size()).toBe(0);
  });

  it("rolls back complete when audit write fails", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Complete",
      originalFileName: "b.jpg",
      declaredSizeBytes: 512,
    });
    ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
    ports.auditRepo.failNextAppend = new Error("audit fail complete");
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        started.media.id as string,
        started.media.revision as number,
      ),
    ).rejects.toThrow(/audit fail complete/);

    const live = await ports.mediaRepo.getById(started.media.id as string);
    expect(live?.status).toBe("uploading");
    expect(live?.revision).toBe(started.media.revision);
    const events = await ports.auditRepo.listByEntity(
      "media",
      started.media.id as string,
    );
    expect(events.some((e) => e.eventType === "media.upload.completed")).toBe(
      false,
    );
  });

  it("rolls back metadata update when audit write fails", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Meta",
      originalFileName: "c.jpg",
      declaredSizeBytes: 512,
    });
    ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
    const ready = await completeMediaUpload(
      ports,
      ctx,
      started.media.id as string,
      started.media.revision as number,
    );

    ports.auditRepo.failNextAppend = new Error("audit fail metadata");
    await expect(
      updateMediaMetadata(
        ports,
        ctx,
        ready.id as string,
        ready.revision as number,
        { title: "After" },
      ),
    ).rejects.toThrow(/audit fail metadata/);

    const live = await ports.mediaRepo.getById(ready.id as string);
    expect(live?.title).toBe("Meta");
    expect(live?.revision).toBe(ready.revision);
  });

  it("rolls back archive when audit write fails", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Arch",
      originalFileName: "d.jpg",
      declaredSizeBytes: 512,
    });
    ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
    const ready = await completeMediaUpload(
      ports,
      ctx,
      started.media.id as string,
      started.media.revision as number,
    );

    ports.auditRepo.failNextAppend = new Error("audit fail archive");
    await expect(
      archiveMedia(ports, ctx, ready.id as string, ready.revision as number),
    ).rejects.toThrow(/audit fail archive/);

    const live = await ports.mediaRepo.getById(ready.id as string);
    expect(live?.status).toBe("ready");
    expect(live?.revision).toBe(ready.revision);
  });
});
