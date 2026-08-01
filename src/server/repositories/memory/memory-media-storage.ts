import { randomBytes } from "node:crypto";

import { RepositoryError } from "@/domain/shared/errors";
import type {
  MediaObjectStat,
  MediaObjectStream,
  MediaStoragePort,
  SignedUploadUrlResult,
} from "../interfaces/media-storage-port";
import { MEMORY_REPOSITORY_MARKER } from "./memory-store";

type StoredObject = {
  bytes: Uint8Array;
  contentType: string | null;
  generation: string;
  checksumCrc32c: string | null;
  etag: string;
};

type UploadToken = {
  storageKey: string;
  expiresAt: number;
  maxBytes: number;
  method: "PUT";
  consumed: boolean;
};

function assertSafeStorageKey(storageKey: string): void {
  if (
    !storageKey ||
    storageKey.includes("..") ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/") ||
    storageKey.includes("\0")
  ) {
    throw new RepositoryError("Invalid storage key");
  }
}

/**
 * TEST_ONLY in-memory object storage for media upload flows.
 */
export class MemoryMediaStorage implements MediaStoragePort {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly objects = new Map<string, StoredObject>();
  private readonly uploadTokens = new Map<string, UploadToken>();
  private generationCounter = 1;
  /** TEST_ONLY: next createSignedUploadUrl throws. */
  failNextSignedUrl: Error | null = null;

  createSignedUploadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
    maxBytes: number;
  }): Promise<SignedUploadUrlResult> {
    if (this.failNextSignedUrl) {
      const err = this.failNextSignedUrl;
      this.failNextSignedUrl = null;
      return Promise.reject(err);
    }
    try {
      assertSafeStorageKey(input.storageKey);
    } catch (error) {
      return Promise.reject(error);
    }
    if (input.maxBytes < 1) {
      return Promise.reject(new RepositoryError("maxBytes must be positive"));
    }
    const token = randomBytes(32).toString("hex");
    const expiresAtMs = Date.now() + input.expiresInSeconds * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();
    this.uploadTokens.set(token, {
      storageKey: input.storageKey,
      expiresAt: expiresAtMs,
      maxBytes: input.maxBytes,
      method: "PUT",
      consumed: false,
    });
    return Promise.resolve({
      uploadUrl: `/api/admin/media/upload-proxy?token=${token}`,
      expiresAt,
      requiredHeaders: {
        "Content-Type": "application/octet-stream",
      },
    });
  }

  /**
   * Validate and consume a one-time upload token (memory proxy / tests).
   */
  consumeUploadToken(
    token: string,
    opts: { method: string; bodyBytes: number; expectedStorageKey?: string },
  ): { storageKey: string } {
    if (!token || token.length < 32) {
      throw new RepositoryError("Invalid upload token");
    }
    const pending = this.uploadTokens.get(token);
    if (!pending) {
      throw new RepositoryError("Upload token unknown");
    }
    if (pending.consumed) {
      throw new RepositoryError("Upload token already used");
    }
    if (pending.expiresAt < Date.now()) {
      this.uploadTokens.delete(token);
      throw new RepositoryError("Upload token expired");
    }
    if (opts.method.toUpperCase() !== pending.method) {
      throw new RepositoryError("Upload method not allowed");
    }
    if (
      opts.expectedStorageKey != null &&
      opts.expectedStorageKey !== pending.storageKey
    ) {
      throw new RepositoryError("Upload token storageKey mismatch");
    }
    if (opts.bodyBytes <= 0 || opts.bodyBytes > pending.maxBytes) {
      throw new RepositoryError("Upload body size rejected");
    }
    pending.consumed = true;
    this.uploadTokens.delete(token);
    return { storageKey: pending.storageKey };
  }

  /** TEST_ONLY peek without consuming */
  peekUploadToken(token: string): UploadToken | null {
    return this.uploadTokens.get(token) ?? null;
  }

  readPrefix(storageKey: string, maxBytes: number): Promise<Uint8Array> {
    const obj = this.objects.get(storageKey);
    if (!obj) {
      throw new RepositoryError("Object not found", { storageKey });
    }
    return Promise.resolve(obj.bytes.slice(0, maxBytes));
  }

  stat(storageKey: string): Promise<MediaObjectStat> {
    const obj = this.objects.get(storageKey);
    if (!obj) {
      return Promise.resolve({
        sizeBytes: 0,
        contentType: null,
        generation: null,
        checksumCrc32c: null,
        etag: null,
        exists: false,
      });
    }
    return Promise.resolve({
      sizeBytes: obj.bytes.byteLength,
      contentType: obj.contentType,
      generation: obj.generation,
      checksumCrc32c: obj.checksumCrc32c,
      etag: obj.etag,
      exists: true,
    });
  }

  openObjectStream(storageKey: string): Promise<MediaObjectStream> {
    const obj = this.objects.get(storageKey);
    if (!obj) {
      throw new RepositoryError("Object not found", { storageKey });
    }
    const bytes = obj.bytes.slice();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return Promise.resolve({ stream, sizeBytes: bytes.byteLength });
  }

  readObject(storageKey: string): Promise<Uint8Array> {
    const obj = this.objects.get(storageKey);
    if (!obj) {
      throw new RepositoryError("Object not found", { storageKey });
    }
    return Promise.resolve(obj.bytes.slice());
  }

  deleteObject(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
    return Promise.resolve();
  }

  /** TEST_ONLY direct write bypassing signed URL flow */
  put(
    storageKey: string,
    bytes: Uint8Array,
    meta?: { contentType?: string | null; checksumCrc32c?: string | null },
  ): void {
    assertSafeStorageKey(storageKey);
    const generation = String(this.generationCounter++);
    this.objects.set(storageKey, {
      bytes: bytes.slice(),
      contentType: meta?.contentType ?? null,
      generation,
      checksumCrc32c: meta?.checksumCrc32c ?? null,
      etag: `"${generation}"`,
    });
  }

  /** TEST_ONLY simulates client upload via signed URL */
  putViaSignedUrl(
    uploadUrl: string,
    bytes: Uint8Array,
    meta?: { contentType?: string | null },
  ): void {
    let token: string | null = null;
    if (uploadUrl.startsWith("memory://")) {
      token = new URL(uploadUrl).searchParams.get("token");
    } else {
      try {
        token = new URL(uploadUrl, "http://local.invalid").searchParams.get(
          "token",
        );
      } catch {
        token = null;
      }
    }
    if (!token) {
      throw new RepositoryError("Missing upload token");
    }
    const { storageKey } = this.consumeUploadToken(token, {
      method: "PUT",
      bodyBytes: bytes.byteLength,
    });
    this.put(storageKey, bytes, meta);
  }

  clear(): void {
    this.objects.clear();
    this.uploadTokens.clear();
    this.generationCounter = 1;
    this.failNextSignedUrl = null;
  }
}
