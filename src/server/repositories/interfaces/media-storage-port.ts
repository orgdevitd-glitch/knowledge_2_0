export type MediaObjectStat = {
  sizeBytes: number;
  contentType: string | null;
  /** Provider generation as string (never coerce to JS number). */
  generation: string | null;
  /** Provider checksum (GCS CRC32C). Not application SHA-256. */
  checksumCrc32c: string | null;
  etag: string | null;
  exists: boolean;
};

export type SignedUploadUrlResult = {
  uploadUrl: string;
  expiresAt: string;
  /**
   * Headers the client MUST send on PUT for GCS signed URLs with
   * extension-header constraints. Memory proxy ignores extras.
   */
  requiredHeaders: Record<string, string>;
};

export type MediaObjectStream = {
  stream: ReadableStream<Uint8Array>;
  sizeBytes: number | null;
};

export interface MediaStoragePort {
  createSignedUploadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
    /** Declared/kind max size — enforced by memory token; GCS relies on complete(). */
    maxBytes: number;
  }): Promise<SignedUploadUrlResult>;
  /** Read up to maxBytes from start of object (sniffing only). */
  readPrefix(storageKey: string, maxBytes: number): Promise<Uint8Array>;
  stat(storageKey: string): Promise<MediaObjectStat>;
  /**
   * Stream object bytes for public delivery. Must not buffer the full object
   * in the GCS adapter (createReadStream). Memory may materialize in-process.
   */
  openObjectStream(storageKey: string): Promise<MediaObjectStream>;
  /** TEST_ONLY / small helpers — prefer openObjectStream for delivery. */
  readObject(storageKey: string): Promise<Uint8Array>;
  deleteObject(storageKey: string): Promise<void>;
}
