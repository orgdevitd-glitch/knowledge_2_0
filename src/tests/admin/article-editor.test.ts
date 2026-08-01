import { describe, expect, it } from "vitest";

import { slugifyTitle } from "@/features/admin/articles/slug";
import {
  createDefaultBlock,
  duplicateBlock,
} from "@/features/admin/articles/block-factory";
import { actionsForStatus } from "@/features/admin/articles/queries";
import { mapDomainErrorToResponse } from "@/server/http/admin-mutation";
import {
  ConflictError,
  DuplicateSlugError,
  NotFoundError,
  ValidationError,
} from "@/domain/shared/errors";
import {
  createArticleUseCase,
  hideArticle,
  publishArticle,
  replaceArticleBlocks,
  restoreArchivedArticle,
  restoreArticleVersion,
  archiveArticle,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import {
  createTestPorts,
  paragraphBlock,
  headingBlock,
  testCtx,
} from "@/tests/builders/content";
import { isPubliclyVisible } from "@/features/public-content/visibility";
import { validateBlocks } from "@/domain/content/blocks";

describe("slugifyTitle", () => {
  it("generates stable slug and does not invent suffixes", () => {
    expect(slugifyTitle("Hello World")).toMatch(/^hello-world$/i);
    expect(slugifyTitle("Привет")).toBeTruthy();
  });
});

describe("block factory", () => {
  it("creates unique ids on duplicate including nested items", () => {
    const steps = createDefaultBlock("steps");
    const dup = duplicateBlock(steps);
    expect(dup.id).not.toBe(steps.id);
    if (steps.type === "steps" && dup.type === "steps") {
      expect(dup.data.items[0]!.id).not.toBe(steps.data.items[0]!.id);
    }
    expect(() => validateBlocks([steps, dup])).not.toThrow();
  });

  it("creates all 22 block types without throwing", () => {
    const types = [
      "heading",
      "paragraph",
      "list",
      "table",
      "image",
      "gallery",
      "video",
      "file",
      "button",
      "link",
      "quote",
      "info",
      "warning",
      "tip",
      "steps",
      "checklist",
      "faq",
      "prompt",
      "code",
      "related-content",
      "divider",
      "table-of-contents",
    ] as const;
    for (const type of types) {
      expect(createDefaultBlock(type).type).toBe(type);
    }
  });
});

describe("admin actions by status", () => {
  it("exposes lifecycle-aligned actions", () => {
    expect(actionsForStatus("draft").canPublish).toBe(true);
    expect(actionsForStatus("draft").canHide).toBe(false);
    expect(actionsForStatus("published").canHide).toBe(true);
    expect(actionsForStatus("archived").canEdit).toBe(false);
    expect(actionsForStatus("archived").canRestoreArchive).toBe(true);
  });
});

describe("admin error mapper", () => {
  it("maps domain errors to safe codes", async () => {
    const conflict = mapDomainErrorToResponse(new ConflictError("x"));
    expect(conflict.status).toBe(409);
    const body = await conflict.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).not.toMatch(/Firestore|stack/i);

    expect(mapDomainErrorToResponse(new NotFoundError("x")).status).toBe(404);
    expect(mapDomainErrorToResponse(new DuplicateSlugError("x")).status).toBe(
      409,
    );
    expect(mapDomainErrorToResponse(new ValidationError("x")).status).toBe(400);
  });
});

describe("article lifecycle visibility", () => {
  it("keeps draft hidden and published visible; restore stays draft", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "vis-guide",
      title: "Visibility",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1"), headingBlock("h1")],
    });
    expect(isPubliclyVisible(created.status)).toBe(false);

    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
    );
    expect(isPubliclyVisible(published.article.status)).toBe(true);

    const hidden = await hideArticle(
      ports,
      ctx,
      created.id,
      published.article.revision,
    );
    expect(isPubliclyVisible(hidden.status)).toBe(false);

    const again = await publishArticle(ports, ctx, created.id, hidden.revision);
    const archived = await archiveArticle(
      ports,
      ctx,
      created.id,
      again.article.revision,
    );
    expect(isPubliclyVisible(archived.status)).toBe(false);

    const restored = await restoreArchivedArticle(
      ports,
      ctx,
      created.id,
      archived.revision,
    );
    expect(restored.status).toBe("draft");
    expect(isPubliclyVisible(restored.status)).toBe(false);

    const withBlocks = await replaceArticleBlocks(
      ports,
      ctx,
      created.id,
      restored.revision,
      [headingBlock("h1"), paragraphBlock("p1")],
    );
    const pub = await publishArticle(
      ports,
      ctx,
      created.id,
      withBlocks.revision,
      "v2",
    );
    const versions = await ports.versions.listByEntity("article", created.id);
    const older = versions.find((v) => v.versionNumber === 1)!;
    const fromVersion = await restoreArticleVersion(
      ports,
      ctx,
      created.id,
      older.id,
      pub.article.revision,
    );
    expect(fromVersion.status).toBe("draft");
    expect(isPubliclyVisible(fromVersion.status)).toBe(false);
  });

  it("rejects stale revision on metadata update", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "conflict-me",
      title: "Conflict",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1")],
    });
    await updateArticleMetadata(ports, ctx, created.id, created.revision, {
      title: "Updated",
    });
    await expect(
      updateArticleMetadata(ports, ctx, created.id, created.revision, {
        title: "Stale",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
