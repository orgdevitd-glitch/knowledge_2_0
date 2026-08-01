import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MEDIA_ENV_BOUNDS,
  resetMediaEnvCacheForTests,
  resolveStorageMode,
} from "@/config/media-env";
import { resetServerEnvCacheForTests } from "@/config/env";

describe("resolveStorageMode fail-closed", () => {
  it("requires explicit gcs in production", () => {
    expect(() =>
      resolveStorageMode({
        nodeEnv: "production",
        rawMode: undefined,
        bucketName: "b",
        persistenceHint: "",
      }),
    ).toThrow(/MEDIA_STORAGE_MODE is required in production/i);
  });

  it("rejects memory in production", () => {
    expect(() =>
      resolveStorageMode({
        nodeEnv: "production",
        rawMode: "memory",
        bucketName: "b",
        persistenceHint: "",
      }),
    ).toThrow(/forbidden in production/i);
  });

  it("rejects unknown mode in production", () => {
    expect(() =>
      resolveStorageMode({
        nodeEnv: "production",
        rawMode: "s3",
        bucketName: "b",
        persistenceHint: "",
      }),
    ).toThrow(/Unknown MEDIA_STORAGE_MODE/i);
  });

  it("rejects unknown mode in development", () => {
    expect(() =>
      resolveStorageMode({
        nodeEnv: "development",
        rawMode: "azure",
        bucketName: null,
        persistenceHint: "",
      }),
    ).toThrow(/Unknown MEDIA_STORAGE_MODE/i);
  });

  it("allows memory in development and test", () => {
    expect(
      resolveStorageMode({
        nodeEnv: "development",
        rawMode: "memory",
        bucketName: null,
        persistenceHint: "",
      }),
    ).toBe("memory");
    expect(
      resolveStorageMode({
        nodeEnv: "test",
        rawMode: undefined,
        bucketName: null,
        persistenceHint: "",
      }),
    ).toBe("memory");
  });

  it("defaults to gcs in development when bucket is set and mode unset", () => {
    expect(
      resolveStorageMode({
        nodeEnv: "development",
        rawMode: undefined,
        bucketName: "my-bucket",
        persistenceHint: "firestore",
      }),
    ).toBe("gcs");
  });

  it("trims mode values", () => {
    expect(
      resolveStorageMode({
        nodeEnv: "development",
        rawMode: " memory ",
        bucketName: "b",
        persistenceHint: "",
      }),
    ).toBe("memory");
  });
});

describe("getMediaLimits env bounds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetMediaEnvCacheForTests();
    resetServerEnvCacheForTests();
  });

  it("rejects gcs without bucket", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("MEDIA_STORAGE_MODE", "gcs");
    vi.stubEnv("MEDIA_GCS_BUCKET", "");
    vi.stubEnv("FIREBASE_STORAGE_BUCKET", "");
    resetMediaEnvCacheForTests();
    resetServerEnvCacheForTests();
    const { getMediaLimits } = await import("@/config/media-env");
    expect(() => getMediaLimits()).toThrow(/bucket/i);
  });

  it("rejects out-of-range TTL", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("MEDIA_STORAGE_MODE", "memory");
    vi.stubEnv(
      "MEDIA_SIGNED_UPLOAD_TTL_SECONDS",
      String(MEDIA_ENV_BOUNDS.signedUploadTtlSecondsMax + 1),
    );
    resetMediaEnvCacheForTests();
    resetServerEnvCacheForTests();
    const { getMediaLimits } = await import("@/config/media-env");
    expect(() => getMediaLimits()).toThrow(/MEDIA_SIGNED_UPLOAD_TTL_SECONDS/);
  });

  it("rejects non-positive max bytes", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("MEDIA_STORAGE_MODE", "memory");
    vi.stubEnv("MEDIA_IMAGE_MAX_BYTES", "0");
    resetMediaEnvCacheForTests();
    resetServerEnvCacheForTests();
    const { getMediaLimits } = await import("@/config/media-env");
    expect(() => getMediaLimits()).toThrow(/MEDIA_IMAGE_MAX_BYTES/);
  });

  it("rejects oversized document max bytes", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("MEDIA_STORAGE_MODE", "memory");
    vi.stubEnv(
      "MEDIA_DOCUMENT_MAX_BYTES",
      String(MEDIA_ENV_BOUNDS.documentMaxBytesMax + 1),
    );
    resetMediaEnvCacheForTests();
    resetServerEnvCacheForTests();
    const { getMediaLimits } = await import("@/config/media-env");
    expect(() => getMediaLimits()).toThrow(/MEDIA_DOCUMENT_MAX_BYTES/);
  });

  it("production forbids silent memory fallback via getMediaLimits", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSISTENCE_MODE", "firestore");
    vi.stubEnv("CONTENT_SOURCE_MODE", "empty");
    vi.stubEnv("AUTH_MODE", "disabled");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo-ckp");
    // no MEDIA_STORAGE_MODE
    resetMediaEnvCacheForTests();
    resetServerEnvCacheForTests();
    const { getMediaLimits } = await import("@/config/media-env");
    expect(() => getMediaLimits()).toThrow(/required in production/i);
  });
});
