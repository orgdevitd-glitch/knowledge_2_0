import { describe, expect, it } from "vitest";

import {
  createMediaAsset,
  markMediaArchived,
  markMediaReady,
  markMediaUploadFailed,
} from "@/domain/content/media";
import { createArticleUseCase } from "@/features/content/application/article-use-cases";
import { createPromptUseCase } from "@/features/content/application/prompt-use-cases";
import { publishArticle } from "@/features/content/application/article-use-cases";
import { publishPrompt } from "@/features/content/application/prompt-use-cases";
import {
  lookupPickerMedia,
  searchPickerMedia,
} from "@/features/admin/pickers/query-picker-media";
import {
  lookupPickerMaterials,
  searchPickerMaterials,
} from "@/features/admin/pickers/query-picker-materials";
import { isUnsetReferenceId } from "@/features/admin/pickers/placeholder-id";
import {
  PICKER_QUERY_MAX_LENGTH,
  PICKER_RESULT_LIMIT,
  PICKER_MEDIA_ITEM_KEYS,
  PICKER_MATERIAL_ITEM_KEYS,
  clampPickerQuery,
  parsePickerIds,
  parsePickerLimit,
} from "@/features/admin/pickers/picker-limits";
import { safeMediaPreviewPath } from "@/features/admin/pickers/picker-types";
import { createTestPorts, paragraphBlock, TEST_NOW, testCtx } from "../builders/content";

function readyMedia(
  ports: ReturnType<typeof createTestPorts>,
  input: { id: string; title: string; kind?: "image" | "document"; file?: string },
) {
  const created = createMediaAsset({
    id: input.id,
    title: input.title,
    kind: input.kind ?? "image",
    originalFileName: input.file ?? "photo.jpg",
    storageProvider: "memory",
    storageKey: `media/${input.id}/abc`,
    ownerId: "user_1",
    now: TEST_NOW,
  });
  const ready = markMediaReady(
    created,
    {
      mimeType: input.kind === "document" ? "application/pdf" : "image/jpeg",
      sizeBytes: 100,
      providerGeneration: "1",
      providerChecksum: null,
      providerEtag: '"1"',
    },
    TEST_NOW,
  );
  return ports.mediaRepo.save(ready, { expectedRevision: 0 });
}

describe("picker query bounds", () => {
  it("clamps query length and parses bounded ids", () => {
    expect(clampPickerQuery(`x${"a".repeat(200)}`).length).toBe(PICKER_QUERY_MAX_LENGTH);
    expect(clampPickerQuery("  hero  ")).toBe("hero");
    expect(parsePickerIds("a, a, b,,c").slice(0, 2)).toEqual(["a", "b"]);
    expect(parsePickerLimit("999")).toBe(PICKER_RESULT_LIMIT);
    expect(parsePickerLimit("-3")).toBe(PICKER_RESULT_LIMIT);
    expect(parsePickerLimit("nope")).toBe(PICKER_RESULT_LIMIT);
    expect(isUnsetReferenceId("media_pending")).toBe(true);
    expect(isUnsetReferenceId("media_abc")).toBe(false);
    expect(safeMediaPreviewPath("media_ok", "/media/media_ok")).toBe(
      "/media/media_ok",
    );
    expect(safeMediaPreviewPath("media_ok", "https://evil.example/x")).toBeNull();
    expect(safeMediaPreviewPath("media_ok", "gs://bucket/key")).toBeNull();
  });
});

describe("media picker queries", () => {
  it("lists only ready assets and hydrates missing/archived", async () => {
    const ports = createTestPorts();
    await readyMedia(ports, { id: "media_ok", title: "Hero image" });
    const uploading = createMediaAsset({
      id: "media_up",
      title: "Uploading",
      kind: "image",
      originalFileName: "up.jpg",
      storageProvider: "memory",
      storageKey: "media/media_up/abc",
      ownerId: "user_1",
      now: TEST_NOW,
    });
    await ports.mediaRepo.save(uploading, { expectedRevision: 0 });
    const failedBase = createMediaAsset({
      id: "media_fail",
      title: "Broken",
      kind: "image",
      originalFileName: "bad.jpg",
      storageProvider: "memory",
      storageKey: "media/media_fail/abc",
      ownerId: "user_1",
      now: TEST_NOW,
    });
    await ports.mediaRepo.save(
      markMediaUploadFailed(failedBase, "OBJECT_MISSING", TEST_NOW),
      { expectedRevision: 0 },
    );

    const archivedBase = await readyMedia(ports, {
      id: "media_arch",
      title: "Old",
    });
    const archived = markMediaArchived(archivedBase, TEST_NOW);
    await ports.mediaRepo.save(archived, { expectedRevision: archivedBase.revision });

    const search = await searchPickerMedia(ports, { q: "hero" });
    expect(search.items.map((i) => i.id)).toEqual(["media_ok"]);
    expect(search.items[0]?.selectable).toBe(true);
    expect(Object.keys(search.items[0]!).sort()).toEqual(
      [...PICKER_MEDIA_ITEM_KEYS].sort(),
    );
    expect(JSON.stringify(search.items[0])).not.toMatch(
      /storageKey|bucket|ownerId|providerGeneration|checksum/,
    );

    const lookup = await lookupPickerMedia(ports, [
      "media_ok",
      "media_arch",
      "media_missing",
      "media_pending",
    ]);
    expect(lookup[0]?.unavailable).toBe(false);
    expect(lookup[1]?.unavailable).toBe(true);
    expect(lookup[2]?.status).toBe("missing");
    expect(lookup[3]?.unavailable).toBe(true);
  });

  it("filters by kind", async () => {
    const ports = createTestPorts();
    await readyMedia(ports, { id: "media_img", title: "Pic" });
    await readyMedia(ports, {
      id: "media_doc",
      title: "Guide",
      kind: "document",
      file: "guide.pdf",
    });
    const images = await searchPickerMedia(ports, { kind: "image" });
    expect(images.items.every((i) => i.kind === "image")).toBe(true);
    const docs = await searchPickerMedia(ports, { kind: "document" });
    expect(docs.items.map((i) => i.id)).toEqual(["media_doc"]);
  });

  it("never returns more than PICKER_RESULT_LIMIT items", async () => {
    const ports = createTestPorts();
    for (let i = 0; i < 25; i += 1) {
      await readyMedia(ports, { id: `media_${i}`, title: `Asset ${i}` });
    }
    const search = await searchPickerMedia(ports, { limit: 999 });
    expect(search.items.length).toBe(PICKER_RESULT_LIMIT);
  });
});

describe("related material picker queries", () => {
  it("searches published titles and excludes current entity", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const draft = await createArticleUseCase(ports, ctx, {
      slug: "draft-a",
      title: "Draft secret",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    const published = await createArticleUseCase(ports, ctx, {
      slug: "pub-a",
      title: "Published guide",
      ownerId: "user_1",
      blocks: [paragraphBlock("p2")],
    });
    await publishArticle(ports, ctx, published.id, published.revision);
    const other = await createArticleUseCase(ports, ctx, {
      slug: "pub-b",
      title: "Another published",
      ownerId: "user_1",
      blocks: [paragraphBlock("p3")],
    });
    await publishArticle(ports, ctx, other.id, other.revision);

    const search = await searchPickerMaterials(ports, {
      entityType: "article",
      q: "published",
      excludeId: other.id,
    });
    expect(search.items.map((i) => i.id)).toEqual([published.id]);
    expect(search.items.every((i) => i.selectable)).toBe(true);
    expect(Object.keys(search.items[0]!).sort()).toEqual(
      [...PICKER_MATERIAL_ITEM_KEYS].sort(),
    );
    expect(JSON.stringify(search.items[0])).not.toMatch(
      /promptText|blocks|body|ownerId|provenance/,
    );

    const excluded = await searchPickerMaterials(ports, {
      entityType: "article",
      excludeIds: [published.id, other.id],
    });
    expect(excluded.items).toEqual([]);

    const drafts = await searchPickerMaterials(ports, {
      entityType: "article",
      q: "secret",
    });
    expect(drafts.items).toEqual([]);

    const lookup = await lookupPickerMaterials(ports, {
      articleIds: [draft.id, "missing_article"],
    });
    expect(lookup[0]?.selectable).toBe(false);
    expect(lookup[0]?.status).toBe("draft");
    expect(lookup[1]?.unavailable).toBe(true);
  });

  it("searches published prompts", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "sum",
      title: "Summarize notes",
      promptText: "Summarize",
      ownerId: "user_1",
    });
    await publishPrompt(ports, ctx, prompt.id, prompt.revision);
    const search = await searchPickerMaterials(ports, {
      entityType: "prompt",
      q: "summarize",
    });
    expect(search.items.map((i) => i.id)).toEqual([prompt.id]);
  });
});
