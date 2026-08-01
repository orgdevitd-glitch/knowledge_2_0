import { beforeEach, describe, expect, it } from "vitest";

import { resetMediaEnvCacheForTests } from "@/config/media-env";
import { ConflictError, ValidationError } from "@/domain/shared/errors";
import {
  completeMediaUpload,
  reissueMediaUploadUrl,
  retryMediaUpload,
  startMediaUpload,
} from "@/features/content/application/media-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

function minimalJpeg(size = 64): Uint8Array {
  const base = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ];
  return new Uint8Array([
    ...base,
    ...Array(Math.max(0, size - base.length)).fill(0),
  ]);
}

describe("media upload hardening", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    process.env.MEDIA_STORAGE_MODE = "memory";
    resetMediaEnvCacheForTests();
    ports = createTestPorts();
  });

  it("creates media.created and media.upload.started in one atomic mutation", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Atomic start",
      originalFileName: "a.jpg",
      declaredSizeBytes: 512,
    });
    const events = await ports.auditRepo.listByEntity(
      "media",
      started.media.id as string,
    );
    expect(events.map((e) => e.eventType).sort()).toEqual([
      "media.created",
      "media.upload.started",
    ]);
  });

  it("does not persist MediaAsset when signed URL generation fails", async () => {
    ports.mediaStorage.failNextSignedUrl = new Error("signed url boom");
    await expect(
      startMediaUpload(ports, ctx, {
        kind: "image",
        title: "No URL",
        originalFileName: "a.jpg",
        declaredSizeBytes: 512,
      }),
    ).rejects.toThrow(ValidationError);
    expect(ports.mediaRepo.size()).toBe(0);
  });

  it("rolls back create+both audits when second audit fails", async () => {
    // First append succeeds (created), second fails (started) → full rollback.
    let appends = 0;
    const originalAppend = ports.auditRepo.append.bind(ports.auditRepo);
    ports.auditRepo.append = async (event) => {
      appends += 1;
      if (appends === 2) {
        throw new Error("audit fail started");
      }
      return originalAppend(event);
    };

    await expect(
      startMediaUpload(ports, ctx, {
        kind: "image",
        title: "Partial audit",
        originalFileName: "a.jpg",
        declaredSizeBytes: 512,
      }),
    ).rejects.toThrow(/audit fail started/);
    expect(ports.mediaRepo.size()).toBe(0);
  });

  it("reissue keeps storageKey for uploading assets", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Reissue",
      originalFileName: "a.jpg",
      declaredSizeBytes: 512,
    });
    const reissued = await reissueMediaUploadUrl(
      ports,
      ctx,
      started.media.id as string,
      started.media.revision as number,
    );
    expect(reissued.media.storageKey).toBe(started.media.storageKey);
    expect(reissued.media.revision).toBe(started.media.revision);
    expect(reissued.uploadUrl).toBeTruthy();
  });

  it("complete is idempotent for ready media (no revision bump, no second completed audit)", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Idempotent",
      originalFileName: "a.jpg",
      declaredSizeBytes: 512,
    });
    ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
    const ready = await completeMediaUpload(
      ports,
      ctx,
      started.media.id as string,
      started.media.revision as number,
    );
    const again = await completeMediaUpload(
      ports,
      ctx,
      ready.id as string,
      ready.revision as number,
    );
    expect(again.revision).toBe(ready.revision);
    expect(again.status).toBe("ready");
    const completed = (
      await ports.auditRepo.listByEntity("media", ready.id as string)
    ).filter((e) => e.eventType === "media.upload.completed");
    expect(completed).toHaveLength(1);
  });

  it("complete rejects ready media when object generation differs", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Gen mismatch",
      originalFileName: "a.jpg",
      declaredSizeBytes: 512,
    });
    ports.mediaStorage.putViaSignedUrl(started.uploadUrl, minimalJpeg());
    const ready = await completeMediaUpload(
      ports,
      ctx,
      started.media.id as string,
      started.media.revision as number,
    );
    // Overwrite object under the same key (simulates provider generation change).
    ports.mediaStorage.put(ready.storageKey, minimalJpeg(80));
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        ready.id as string,
        ready.revision as number,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("complete after retry cannot confirm the old storageKey object", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "Old key",
      originalFileName: "a.jpg",
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
    ports.mediaStorage.put(oldKey, minimalJpeg());

    const retried = await retryMediaUpload(
      ports,
      ctx,
      failed!.id as string,
      failed!.revision as number,
    );
    expect(retried.media.storageKey).not.toBe(oldKey);
    // Object only under old key — complete against new key must fail.
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        retried.media.id as string,
        retried.media.revision as number,
      ),
    ).rejects.toThrow(ValidationError);
    const live = await ports.mediaRepo.getById(retried.media.id as string);
    expect(live?.status).toBe("failed");
  });

  it("failed validation stays failed without becoming ready", async () => {
    const started = await startMediaUpload(ports, ctx, {
      kind: "image",
      title: "HTML",
      originalFileName: "a.jpg",
      declaredSizeBytes: 512,
    });
    ports.mediaStorage.putViaSignedUrl(
      started.uploadUrl,
      new TextEncoder().encode("<html>x</html>"),
    );
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        started.media.id as string,
        started.media.revision as number,
      ),
    ).rejects.toThrow(ValidationError);
    await expect(
      completeMediaUpload(
        ports,
        ctx,
        started.media.id as string,
        started.media.revision as number,
      ),
    ).rejects.toThrow(/retry before completing/i);
  });
});

describe("memory upload token security", () => {
  let ports: ReturnType<typeof createTestPorts>;

  beforeEach(() => {
    process.env.MEDIA_STORAGE_MODE = "memory";
    resetMediaEnvCacheForTests();
    ports = createTestPorts();
  });

  it("rejects wrong token, expired, reused, oversized, wrong method, path traversal key", async () => {
    const signed = await ports.mediaStorage.createSignedUploadUrl({
      storageKey: "media/media_1/abcdef0123456789abcdef0123456789",
      expiresInSeconds: 60,
      maxBytes: 100,
    });
    const token = new URL(signed.uploadUrl, "http://local").searchParams.get(
      "token",
    )!;

    expect(() =>
      ports.mediaStorage.consumeUploadToken("deadbeef".repeat(4), {
        method: "PUT",
        bodyBytes: 10,
      }),
    ).toThrow(/unknown/i);

    expect(() =>
      ports.mediaStorage.consumeUploadToken(token, {
        method: "POST",
        bodyBytes: 10,
      }),
    ).toThrow(/method/i);

    expect(() =>
      ports.mediaStorage.consumeUploadToken(token, {
        method: "PUT",
        bodyBytes: 101,
      }),
    ).toThrow(/size/i);

    expect(() =>
      ports.mediaStorage.consumeUploadToken(token, {
        method: "PUT",
        bodyBytes: 10,
        expectedStorageKey: "media/other/key",
      }),
    ).toThrow(/mismatch/i);

    ports.mediaStorage.consumeUploadToken(token, {
      method: "PUT",
      bodyBytes: 10,
    });
    expect(() =>
      ports.mediaStorage.consumeUploadToken(token, {
        method: "PUT",
        bodyBytes: 10,
      }),
    ).toThrow(/unknown|already used/i);

    await expect(
      ports.mediaStorage.createSignedUploadUrl({
        storageKey: "media/../evil/obj",
        expiresInSeconds: 60,
        maxBytes: 10,
      }),
    ).rejects.toThrow(/Invalid storage key/i);

    const short = await ports.mediaStorage.createSignedUploadUrl({
      storageKey: "media/media_1/abcdef0123456789abcdef0123456789",
      expiresInSeconds: 1,
      maxBytes: 50,
    });
    const shortToken = new URL(
      short.uploadUrl,
      "http://local",
    ).searchParams.get("token")!;
    const pending = ports.mediaStorage.peekUploadToken(shortToken)!;
    // Force expiry
    (pending as { expiresAt: number }).expiresAt = Date.now() - 1;
    expect(() =>
      ports.mediaStorage.consumeUploadToken(shortToken, {
        method: "PUT",
        bodyBytes: 10,
      }),
    ).toThrow(/expired/i);
  });
});
