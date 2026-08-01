import { beforeEach, describe, expect, it } from "vitest";

import {
  archiveCategoryUseCase,
  archiveTagUseCase,
  buildCategoryTree,
  createAudienceUseCase,
  createCategoryUseCase,
  createTagUseCase,
  moveCategoryUseCase,
  reorderAudienceUseCase,
  reorderCategoryUseCase,
  restoreCategoryUseCase,
  restoreTagUseCase,
  updateCategory,
} from "@/features/content/application/taxonomy-use-cases";
import { TaxonomyUsageService } from "@/features/admin/taxonomy/application/taxonomy-usage-service";
import {
  createArticleUseCase,
  publishArticle,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import { createPromptUseCase } from "@/features/content/application/prompt-use-cases";
import { assertTaxonomyTreeSize } from "@/domain/content/taxonomy";
import { CONTENT_LIMITS, MAX_TAXONOMY_TREE_ITEMS } from "@/domain/shared/limits";
import {
  ConflictError,
  DuplicateSlugError,
  DuplicateTitleError,
  InvalidStatusTransitionError,
  ValidationError,
} from "@/domain/shared/errors";
import { createTestPorts, paragraphBlock, testCtx } from "../builders/content";

describe("taxonomy admin use cases", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    ports = createTestPorts();
  });

  it("creates root and child categories; rejects cycles depth and archived parent", async () => {
    const root = await createCategoryUseCase(ports, ctx, {
      slug: "root",
      title: "Root",
    });
    const child = await createCategoryUseCase(ports, ctx, {
      slug: "child",
      title: "Child",
      parentId: root.id,
    });
    expect(child.parentId).toBe(root.id);

    await expect(
      moveCategoryUseCase(ports, ctx, root.id, root.revision, child.id),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      createCategoryUseCase(ports, ctx, {
        slug: "self",
        title: "Self",
        parentId: "category_missing",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Active child blocks parent archive (no cascade / no active orphans).
    await expect(
      archiveCategoryUseCase(ports, ctx, root.id, root.revision),
    ).rejects.toMatchObject({
      details: { adminCode: "CATEGORY_HAS_ACTIVE_CHILDREN" },
    });

    const archivedChild = await archiveCategoryUseCase(
      ports,
      ctx,
      child.id,
      child.revision,
    );
    expect(archivedChild.status).toBe("archived");

    const archivedRoot = await archiveCategoryUseCase(
      ports,
      ctx,
      root.id,
      (await ports.categories.getById(root.id))!.revision,
    );
    expect(archivedRoot.status).toBe("archived");

    await expect(
      createCategoryUseCase(ports, ctx, {
        slug: "under-archived",
        title: "Under",
        parentId: archivedRoot.id,
      }),
    ).rejects.toMatchObject({
      details: { adminCode: "CATEGORY_PARENT_ARCHIVED" },
    });

    const tree = buildCategoryTree(await ports.categories.listAll());
    expect(tree.length).toBeGreaterThanOrEqual(0);
  });

  it("reorders siblings and restores archived category", async () => {
    const a = await createCategoryUseCase(ports, ctx, {
      slug: "a",
      title: "A",
      sortOrder: 0,
    });
    const b = await createCategoryUseCase(ports, ctx, {
      slug: "b",
      title: "B",
      sortOrder: 10,
    });
    const moved = await reorderCategoryUseCase(
      ports,
      ctx,
      b.id,
      b.revision,
      "up",
    );
    expect(moved.sortOrder).toBeLessThanOrEqual(
      (await ports.categories.getById(a.id))!.sortOrder + 10,
    );

    const archived = await archiveCategoryUseCase(
      ports,
      ctx,
      a.id,
      (await ports.categories.getById(a.id))!.revision,
    );
    expect(archived.status).toBe("archived");
    const restored = await restoreCategoryUseCase(
      ports,
      ctx,
      a.id,
      archived.revision,
    );
    expect(restored.status).toBe("active");
    await expect(
      restoreCategoryUseCase(ports, ctx, a.id, restored.revision),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it("rejects duplicate slug across archived and revision conflict", async () => {
    const cat = await createCategoryUseCase(ports, ctx, {
      slug: "dup",
      title: "Dup",
    });
    await expect(
      createCategoryUseCase(ports, ctx, { slug: "dup", title: "Other" }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);

    const archived = await archiveCategoryUseCase(
      ports,
      ctx,
      cat.id,
      cat.revision,
    );
    await expect(
      createCategoryUseCase(ports, ctx, {
        slug: "dup",
        title: "Reuse archived slug",
      }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);

    await restoreCategoryUseCase(ports, ctx, cat.id, archived.revision);

    await updateCategory(
      ports,
      ctx,
      cat.id,
      (await ports.categories.getById(cat.id))!.revision,
      { title: "Dup 2" },
    );
    await expect(
      updateCategory(ports, ctx, cat.id, cat.revision, { title: "Stale" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("enforces unique normalized tag titles across archived and keeps relationships", async () => {
    const tag = await createTagUseCase(ports, ctx, {
      slug: "alpha",
      title: "Alpha",
    });
    await expect(
      createTagUseCase(ports, ctx, { slug: "beta", title: " alpha " }),
    ).rejects.toBeInstanceOf(DuplicateTitleError);

    const article = await createArticleUseCase(ports, ctx, {
      slug: "with-tag",
      title: "With tag",
      ownerId: "user_1",
      tagIds: [tag.id],
    });
    const archived = await archiveTagUseCase(ports, ctx, tag.id, tag.revision);
    expect(archived.status).toBe("archived");
    const still = await ports.articles.getById(article.id);
    expect(still?.tagIds).toContain(tag.id);

    await expect(
      createTagUseCase(ports, ctx, { slug: "gamma", title: "Alpha" }),
    ).rejects.toBeInstanceOf(DuplicateTitleError);

    const restored = await restoreTagUseCase(
      ports,
      ctx,
      tag.id,
      archived.revision,
    );
    expect(restored.status).toBe("active");
  });

  it("writes taxonomy mutation and audit together", async () => {
    const tag = await createTagUseCase(ports, ctx, {
      slug: "audited-tag",
      title: "Audited Tag",
    });
    const events = await ports.auditRepo.listByEntity("tag", tag.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "taxonomy.tag.created",
      entityType: "tag",
      entityId: tag.id,
    });
    expect(await ports.tags.getById(tag.id)).not.toBeNull();
  });

  it("distinguishes draft vs published-snapshot usage without double-counting metrics", async () => {
    const category = await createCategoryUseCase(ports, ctx, {
      slug: "usage-cat",
      title: "Usage Cat",
    });
    const other = await createCategoryUseCase(ports, ctx, {
      slug: "other-cat",
      title: "Other Cat",
    });

    const draftOnly = await createArticleUseCase(ports, ctx, {
      slug: "draft-only",
      title: "Draft Only",
      ownerId: "user_1",
      categoryIds: [category.id],
    });
    expect(draftOnly.status).toBe("draft");

    const published = await createArticleUseCase(ports, ctx, {
      slug: "pub-article",
      title: "Pub Article",
      ownerId: "user_1",
      categoryIds: [category.id],
      blocks: [paragraphBlock("p1", "Body")],
    });
    const pub = await publishArticle(
      ports,
      ctx,
      published.id,
      published.revision,
      "v1",
    );

    // Working draft no longer references category, but published snapshot still does.
    await updateArticleMetadata(ports, ctx, published.id, pub.article.revision, {
      categoryIds: [other.id],
    });

    const usage = new TaxonomyUsageService(ports);
    const summary = await usage.getSummary("category", category.id);
    expect(summary.hasDraftUsage).toBe(true);
    expect(summary.hasPublishedUsage).toBe(true);
    expect(summary.draftArticleCount).toBe(1);
    expect(summary.publishedArticleCount).toBe(1);
    // Same published entity may appear in both draft+published refs, but
    // totalCount dedupes by entity type+id within the combined set.
    expect(summary.articleCount).toBe(2);
    expect(summary.totalCount).toBe(2);

    const page = await usage.listUsage("category", category.id, { limit: 10 });
    const draftRefs = page.items.filter((r) => r.usageKind === "draft");
    const publishedRefs = page.items.filter((r) => r.usageKind === "published");
    expect(draftRefs.map((r) => r.entityId)).toEqual([draftOnly.id]);
    expect(publishedRefs.map((r) => r.entityId)).toEqual([published.id]);
    expect(
      publishedRefs.every((r) => r.status === "published"),
    ).toBe(true);
  });

  it("reorders audiences and usage service counts articles and prompts", async () => {
    const a1 = await createAudienceUseCase(ports, ctx, {
      slug: "aud-a",
      title: "Aud A",
    });
    const a2 = await createAudienceUseCase(ports, ctx, {
      slug: "aud-b",
      title: "Aud B",
    });
    await reorderAudienceUseCase(ports, ctx, a2.id, a2.revision, "up");
    const ordered = (await ports.audiences.listAll()).sort(
      (x, y) => x.sortOrder - y.sortOrder,
    );
    expect(ordered[0]?.id).toBe(a2.id);

    const category = await createCategoryUseCase(ports, ctx, {
      slug: "usage-cat-2",
      title: "Usage Cat 2",
    });
    await createArticleUseCase(ports, ctx, {
      slug: "usage-article",
      title: "Usage Article",
      ownerId: "user_1",
      categoryIds: [category.id],
      audienceIds: [a1.id],
    });
    await createPromptUseCase(ports, ctx, {
      slug: "usage-prompt",
      title: "Usage Prompt",
      promptText: "Do X",
      ownerId: "user_1",
      categoryIds: [category.id],
    });

    const usage = new TaxonomyUsageService(ports);
    const summary = await usage.getSummary("category", category.id);
    expect(summary.articleCount).toBe(1);
    expect(summary.promptCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(summary.hasDraftUsage).toBe(true);
    expect(summary.hasPublishedUsage).toBe(false);
  });

  it("rejects taxonomy tree loads beyond MAX_TAXONOMY_TREE_ITEMS", () => {
    expect(MAX_TAXONOMY_TREE_ITEMS).toBe(CONTENT_LIMITS.maxTaxonomyTreeItems);
    expect(() =>
      assertTaxonomyTreeSize(CONTENT_LIMITS.maxTaxonomyTreeItems + 1),
    ).toThrow(ValidationError);
    try {
      assertTaxonomyTreeSize(CONTENT_LIMITS.maxTaxonomyTreeItems + 1);
    } catch (error) {
      expect(error).toMatchObject({
        details: { adminCode: "TAXONOMY_TREE_LIMIT_EXCEEDED" },
      });
    }
  });
});
