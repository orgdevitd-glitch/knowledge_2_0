import { describe, expect, it, vi, beforeEach } from "vitest";

import type { ActiveSearchDocument } from "@/domain/search/search-document";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";

/**
 * Boundary tests for GcsSearchIndexAdapter — mocked firebase-admin/storage.
 */

const save = vi.fn();
const download = vi.fn();
const exists = vi.fn();
const getMetadata = vi.fn();

vi.mock("@/server/firebase/admin", () => ({
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        path,
        save,
        download,
        exists,
        getMetadata,
      }),
    }),
  }),
}));

function sampleDoc(): ActiveSearchDocument {
  return {
    id: "article:a1",
    entityType: "article",
    entityId: "a1",
    sourceRevision: 1,
    versionId: "ver_1",
    versionNumber: 1,
    state: "active",
    slug: "a1",
    href: "/articles/a1",
    title: "Alpha",
    summary: null,
    bodyText: "body",
    promptText: null,
    headings: [],
    categoryIds: [],
    tagIds: [],
    audienceIds: [],
    publishedAt: "2024-06-15T12:00:00.000Z",
    searchableText: "Alpha body",
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
  };
}

describe("GcsSearchIndexAdapter boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    save.mockReset();
    download.mockReset();
    exists.mockReset();
    getMetadata.mockReset();
    process.env.SEARCH_INDEX_MODE = "gcs";
    process.env.SEARCH_INDEX_BUCKET = "test-search-bucket";
  });

  it("writes immutable generation with ifGenerationMatch 0 and CAS manifest", async () => {
    const { resetSearchEnvCacheForTests } = await import("@/config/search-env");
    resetSearchEnvCacheForTests();

    exists.mockResolvedValue([false]);
    save.mockResolvedValue(undefined);

    const { GcsSearchIndexAdapter } = await import(
      "@/server/search/gcs-search-index"
    );

    const adapter = new GcsSearchIndexAdapter("test-search-bucket");
    const result = await adapter.replaceGeneration([sampleDoc()], {
      providerGeneration: null,
      generationId: null,
    });
    expect(result.generationId).toMatch(/^gen_/);
    expect(save).toHaveBeenCalled();
    const generationCall = save.mock.calls.find((c) =>
      JSON.stringify(c[1]?.preconditionOpts).includes('"ifGenerationMatch":0'),
    );
    expect(generationCall).toBeTruthy();
    const body = String(save.mock.calls[0]?.[0] ?? "");
    expect(body).not.toContain("gs://");
    expect(body).not.toContain("test-search-bucket");
  });

  it("maps manifest precondition failure to CAS conflict without raw provider leak", async () => {
    const { resetSearchEnvCacheForTests } = await import("@/config/search-env");
    resetSearchEnvCacheForTests();

    exists.mockImplementation(async () => [false]);
    save.mockImplementation(async () => {
      const callIndex = save.mock.calls.length;
      if (callIndex % 2 === 0) {
        throw new Error("Precondition Failed 412");
      }
      return undefined;
    });

    const { GcsSearchIndexAdapter } = await import(
      "@/server/search/gcs-search-index"
    );
    const { ConflictError } = await import("@/domain/shared/errors");

    const adapter = new GcsSearchIndexAdapter("test-search-bucket");
    try {
      await adapter.replaceGeneration([sampleDoc()], {
        providerGeneration: null,
        generationId: null,
      });
      expect.fail("expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect(String((error as Error).message)).not.toMatch(/gs:\/\//);
      expect(
        (error as { details?: { adminCode?: string } }).details?.adminCode,
      ).toBe("SEARCH_INDEX_REBUILD_CONFLICT");
    }
  });

  it("keeps provider generation as string on manifest read", async () => {
    const { resetSearchEnvCacheForTests } = await import("@/config/search-env");
    resetSearchEnvCacheForTests();

    exists.mockResolvedValue([true]);
    download.mockResolvedValue([
      Buffer.from(
        JSON.stringify({
          schemaVersion: 2,
          generationId: "gen_abc_0123456789ab",
          createdAt: "2024-06-15T12:00:00.000Z",
          documentCount: 0,
          activeDocumentCount: 0,
          indexChecksum: "abcdef0123456789abcdef0123456789",
          previousGenerationId: null,
        }),
      ),
    ]);
    getMetadata.mockResolvedValue([{ generation: "9007199254740993" }]);

    const { GcsSearchIndexAdapter } = await import(
      "@/server/search/gcs-search-index"
    );
    const adapter = new GcsSearchIndexAdapter("test-search-bucket");
    const manifest = await adapter.getCurrentGeneration();
    expect(manifest?.providerGeneration).toBe("9007199254740993");
    expect(typeof manifest?.providerGeneration).toBe("string");
  });
});
