import { describe, expect, it, vi } from "vitest";

/**
 * Boundary tests for GcsMediaStorageAdapter — mocked firebase-admin/storage.
 * Proves signed URL contract and streaming delivery without full buffering.
 */

const getSignedUrl = vi.fn();
const createReadStream = vi.fn();
const download = vi.fn();
const exists = vi.fn();
const getMetadata = vi.fn();
const deleteFn = vi.fn();

vi.mock("@/server/firebase/admin", () => ({
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: () => ({
        getSignedUrl,
        createReadStream,
        download,
        exists,
        getMetadata,
        delete: deleteFn,
      }),
    }),
  }),
}));

describe("GcsMediaStorageAdapter boundary", () => {
  it("signed upload URL is PUT/write with octet-stream and generation precondition", async () => {
    getSignedUrl.mockResolvedValueOnce(["https://storage.example/signed-put"]);
    const { GcsMediaStorageAdapter } = await import(
      "@/server/storage/gcs-media-storage"
    );
    const adapter = new GcsMediaStorageAdapter("test-bucket");
    const result = await adapter.createSignedUploadUrl({
      storageKey: "media/media_1/abc",
      expiresInSeconds: 900,
      maxBytes: 5_000_000,
    });

    expect(result.uploadUrl).toContain("https://");
    expect(result.requiredHeaders["Content-Type"]).toBe(
      "application/octet-stream",
    );
    expect(result.requiredHeaders["x-goog-if-generation-match"]).toBe("0");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "v4",
        action: "write",
        contentType: "application/octet-stream",
        extensionHeaders: {
          "x-goog-if-generation-match": "0",
        },
      }),
    );
  });

  it("openObjectStream uses createReadStream and never calls download", async () => {
    exists.mockResolvedValueOnce([true]);
    getMetadata.mockResolvedValueOnce([{ size: "42", generation: "9" }]);
    const { PassThrough } = await import("node:stream");
    const pass = new PassThrough();
    createReadStream.mockReturnValueOnce(pass);
    queueMicrotask(() => {
      pass.write(Buffer.from("hi"));
      pass.end();
    });

    const { GcsMediaStorageAdapter } = await import(
      "@/server/storage/gcs-media-storage"
    );
    const adapter = new GcsMediaStorageAdapter("test-bucket");
    const { stream, sizeBytes } = await adapter.openObjectStream(
      "media/media_1/abc",
    );
    expect(sizeBytes).toBe(42);
    expect(createReadStream).toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c))).toString()).toBe(
      "hi",
    );
  });
});
