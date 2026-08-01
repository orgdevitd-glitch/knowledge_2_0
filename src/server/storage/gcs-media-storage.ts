import "server-only";

import { Readable } from "node:stream";

import { RepositoryError } from "@/domain/shared/errors";
import { getFirebaseAdminStorage } from "@/server/firebase/admin";
import type {
  MediaObjectStat,
  MediaObjectStream,
  MediaStoragePort,
  SignedUploadUrlResult,
} from "@/server/repositories/interfaces/media-storage-port";

function resolveBucketName(explicit?: string): string {
  const name =
    explicit ??
    process.env.MEDIA_GCS_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) {
    throw new RepositoryError("GCS media bucket is not configured");
  }
  return name;
}

/**
 * Production media binary adapter (firebase-admin/storage).
 *
 * Signed PUT URLs are v4 write URLs bound to one object key, Content-Type
 * application/octet-stream, short TTL, and ifGenerationMatch=0 (no overwrite).
 *
 * Object size is NOT enforced by the signed URL itself (GCS content-length-range
 * would require the browser to send a matching extension header on every PUT;
 * Phase 7B enforces declared size at start and actual size at complete instead).
 * Production monitoring should track oversized orphan objects after failed complete.
 */
export class GcsMediaStorageAdapter implements MediaStoragePort {
  constructor(private readonly bucketName?: string) {}

  private bucket() {
    return getFirebaseAdminStorage().bucket(resolveBucketName(this.bucketName));
  }

  async createSignedUploadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
    maxBytes: number;
  }): Promise<SignedUploadUrlResult> {
    void input.maxBytes; // enforced at start + complete; not in signed URL
    try {
      const expiresMs = Date.now() + input.expiresInSeconds * 1000;
      const requiredHeaders: Record<string, string> = {
        "Content-Type": "application/octet-stream",
        "x-goog-if-generation-match": "0",
      };
      const [uploadUrl] = await this.bucket()
        .file(input.storageKey)
        .getSignedUrl({
          version: "v4",
          action: "write",
          expires: expiresMs,
          contentType: "application/octet-stream",
          extensionHeaders: {
            "x-goog-if-generation-match": "0",
          },
        });
      return {
        uploadUrl,
        expiresAt: new Date(expiresMs).toISOString(),
        requiredHeaders,
      };
    } catch (error) {
      throw new RepositoryError("Failed to create signed upload URL", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async readPrefix(storageKey: string, maxBytes: number): Promise<Uint8Array> {
    if (maxBytes < 1) {
      throw new RepositoryError("readPrefix maxBytes must be positive");
    }
    const file = this.bucket().file(storageKey);
    const [exists] = await file.exists();
    if (!exists) {
      throw new RepositoryError("Object not found");
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      const stream = file.createReadStream({ start: 0, end: maxBytes - 1 });
      stream.on("data", (chunk: Buffer) => {
        if (total >= maxBytes) return;
        const remaining = maxBytes - total;
        const slice =
          chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        chunks.push(slice);
        total += slice.length;
      });
      stream.on("error", (error) => {
        reject(
          new RepositoryError("Failed to read object prefix", {
            cause: error instanceof Error ? error.message : "unknown",
          }),
        );
      });
      stream.on("end", () => {
        resolve(new Uint8Array(Buffer.concat(chunks)));
      });
    });
  }

  async stat(storageKey: string): Promise<MediaObjectStat> {
    try {
      const file = this.bucket().file(storageKey);
      const [exists] = await file.exists();
      if (!exists) {
        return {
          sizeBytes: 0,
          contentType: null,
          generation: null,
          checksumCrc32c: null,
          etag: null,
          exists: false,
        };
      }
      const [metadata] = await file.getMetadata();
      return {
        sizeBytes: Number(metadata.size ?? 0),
        contentType: metadata.contentType ?? null,
        generation:
          metadata.generation != null ? String(metadata.generation) : null,
        checksumCrc32c: metadata.crc32c ?? null,
        etag: metadata.etag ?? null,
        exists: true,
      };
    } catch (error) {
      throw new RepositoryError("Failed to stat object", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async openObjectStream(storageKey: string): Promise<MediaObjectStream> {
    try {
      const file = this.bucket().file(storageKey);
      const [exists] = await file.exists();
      if (!exists) {
        throw new RepositoryError("Object not found");
      }
      const [metadata] = await file.getMetadata();
      const sizeRaw = metadata.size;
      const sizeBytes =
        sizeRaw != null && Number.isFinite(Number(sizeRaw))
          ? Number(sizeRaw)
          : null;
      const nodeStream = file.createReadStream();
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      return { stream: webStream, sizeBytes };
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError("Failed to open object stream", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async readObject(storageKey: string): Promise<Uint8Array> {
    try {
      const file = this.bucket().file(storageKey);
      const [exists] = await file.exists();
      if (!exists) {
        throw new RepositoryError("Object not found");
      }
      const [buffer] = await file.download();
      return new Uint8Array(buffer);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError("Failed to read object", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    try {
      const file = this.bucket().file(storageKey);
      const [exists] = await file.exists();
      if (!exists) return;
      await file.delete();
    } catch (error) {
      throw new RepositoryError("Failed to delete object", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
