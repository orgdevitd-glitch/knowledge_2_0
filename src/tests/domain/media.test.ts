import { describe, expect, it } from "vitest";

import {
  assertMediaBinaryImmutable,
  createMediaAsset,
  markMediaArchived,
  markMediaReady,
  markMediaRestoredReady,
  markMediaRetryUpload,
  markMediaUploadFailed,
  withMediaMetadataUpdate,
} from "@/domain/content/media";
import {
  extractFileExtension,
  sanitizeOriginalFileName,
  sniffMediaContent,
} from "@/domain/content/media-sniff";
import { MEDIA_LIMIT_DEFAULTS } from "@/domain/shared/media-limits";
import { ValidationError } from "@/domain/shared/errors";
import { TEST_NOW } from "../builders/content";

function minimalJpeg(extra = 0): Uint8Array {
  const base = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ];
  return new Uint8Array([...base, ...Array(extra).fill(0)]);
}

function minimalPng(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
}

function minimalPdf(): Uint8Array {
  const text = "%PDF-1.4\n1 0 obj";
  return new Uint8Array([...text].map((c) => c.charCodeAt(0)));
}

function baseMedia(overrides: Partial<Parameters<typeof createMediaAsset>[0]> = {}) {
  return createMediaAsset({
    id: "media_1",
    title: "Photo",
    kind: "image",
    originalFileName: "photo.jpg",
    storageProvider: "memory",
    storageKey: "media/media_1/abc123",
    ownerId: "user_1",
    now: TEST_NOW,
    ...overrides,
  });
}

describe("media domain", () => {
  it("transitions uploading to ready and failed", () => {
    const uploading = baseMedia();
    expect(uploading.status).toBe("uploading");

    const ready = markMediaReady(
      uploading,
      {
        mimeType: "image/jpeg",
        sizeBytes: 100,
        providerGeneration: "1",
        providerChecksum: null,
        providerEtag: '"1"',
      },
      TEST_NOW,
    );
    expect(ready.status).toBe("ready");
    expect(ready.mimeType).toBe("image/jpeg");

    const failed = markMediaUploadFailed(uploading, "OBJECT_MISSING", TEST_NOW);
    expect(failed.status).toBe("failed");
    expect(failed.failureReasonCode).toBe("OBJECT_MISSING");
  });

  it("rejects invalid status transitions", () => {
    const ready = markMediaReady(
      baseMedia(),
      {
        mimeType: "image/jpeg",
        sizeBytes: 1,
        providerGeneration: null,
        providerChecksum: null,
        providerEtag: null,
      },
      TEST_NOW,
    );
    expect(() =>
      markMediaReady(ready, {
        mimeType: "image/jpeg",
        sizeBytes: 1,
        providerGeneration: null,
        providerChecksum: null,
        providerEtag: null,
      }, TEST_NOW),
    ).toThrow(ValidationError);

    expect(() => markMediaRetryUpload(ready, "media/media_1/newkey", TEST_NOW)).toThrow(
      ValidationError,
    );
  });

  it("ready binary is immutable and retry refuses ready", () => {
    const ready = markMediaReady(
      baseMedia(),
      {
        mimeType: "image/jpeg",
        sizeBytes: 1,
        providerGeneration: null,
        providerChecksum: null,
        providerEtag: null,
      },
      TEST_NOW,
    );
    expect(() => assertMediaBinaryImmutable(ready)).toThrow(/cannot be replaced/);
  });

  it("archives ready media and restores from archived", () => {
    const ready = markMediaReady(
      baseMedia(),
      {
        mimeType: "image/jpeg",
        sizeBytes: 1,
        providerGeneration: null,
        providerChecksum: null,
        providerEtag: null,
      },
      TEST_NOW,
    );
    const archived = markMediaArchived(ready, TEST_NOW);
    expect(archived.status).toBe("archived");
    const restored = markMediaRestoredReady(archived, TEST_NOW);
    expect(restored.status).toBe("ready");
  });

  it("retry upload from failed allocates new storage key", () => {
    const failed = markMediaUploadFailed(baseMedia(), "SNIFF_FAILED", TEST_NOW);
    const retried = markMediaRetryUpload(
      failed,
      "media/media_1/deadbeef",
      TEST_NOW,
    );
    expect(retried.status).toBe("uploading");
    expect(retried.storageKey).toBe("media/media_1/deadbeef");
    expect(retried.mimeType).toBeNull();
  });

  it("sniffs JPEG, PNG, WebP, and PDF", () => {
    expect(
      sniffMediaContent({
        prefix: minimalJpeg(),
        fileExtension: "jpg",
        expectedKind: "image",
      }).ok,
    ).toBe(true);

    expect(
      sniffMediaContent({
        prefix: minimalPng(),
        fileExtension: "png",
        expectedKind: "image",
      }).ok,
    ).toBe(true);

    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(
      sniffMediaContent({
        prefix: webp,
        fileExtension: "webp",
        expectedKind: "image",
      }).ok,
    ).toBe(true);

    expect(
      sniffMediaContent({
        prefix: minimalPdf(),
        fileExtension: "pdf",
        expectedKind: "document",
      }).ok,
    ).toBe(true);
  });

  it("rejects binary disguised as text", () => {
    const binaryBlob = new Uint8Array(64);
    for (let i = 0; i < binaryBlob.length; i += 1) {
      binaryBlob[i] = i % 2 === 0 ? 0x01 : 0x02;
    }
    const result = sniffMediaContent({
      prefix: binaryBlob,
      fileExtension: "txt",
      expectedKind: "document",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReasonCode).toBe("BINARY_DISGUISED_AS_TEXT");
    }
  });

  it("sanitizes path traversal in original filename", () => {
    const sanitized = sanitizeOriginalFileName(
      "..\\..\\etc\\passwd.jpg",
      MEDIA_LIMIT_DEFAULTS.originalFileNameMax,
    );
    expect(sanitized).toBe("passwd.jpg");
    expect(extractFileExtension(sanitized)).toBe("jpg");
    expect(sanitizeOriginalFileName("../../../", 200)).toBe("file");
  });

  it("rejects invalid storage keys on create", () => {
    expect(() =>
      createMediaAsset({
        id: "media_2",
        title: "X",
        kind: "image",
        originalFileName: "x.jpg",
        storageProvider: "memory",
        storageKey: "../escape",
        ownerId: "user_1",
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });

  it("forbids metadata edit while uploading", () => {
    expect(() =>
      withMediaMetadataUpdate(baseMedia(), { title: "New" }, TEST_NOW),
    ).toThrow(ValidationError);
  });
});
