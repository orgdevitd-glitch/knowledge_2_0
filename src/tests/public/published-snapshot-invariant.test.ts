/**
 * Public visibility: published Article must serve ContentVersion snapshot,
 * not live working-copy blocks, until republish.
 */
import { describe, expect, it } from "vitest";

import {
  articleFromPublishedSnapshot,
  toArticleSnapshot,
} from "@/domain/content/article";
import {
  createArticleUseCase,
  publishArticle,
  replaceArticleBlocks,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import {
  archiveCategoryUseCase,
  createCategoryUseCase,
} from "@/features/content/application/taxonomy-use-cases";
import { buildCatalogPage } from "@/features/public-content/catalog";
import { isPubliclyVisible } from "@/features/public-content/visibility";
import {
  createTestPorts,
  headingBlock,
  paragraphBlock,
  testCtx,
} from "@/tests/builders/content";

describe("published working copy vs public snapshot", () => {
  it("public materialization keeps last published blocks after live edit", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "pub-invariant",
      title: "Invariant",
      ownerId: "user_1",
      blocks: [headingBlock("h1", "Original"), paragraphBlock("p1", "A")],
    });
    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    const versionId = published.versionId;
    const version = await ports.versions.getById(versionId);
    expect(version).not.toBeNull();

    const live = await replaceArticleBlocks(
      ports,
      ctx,
      created.id,
      published.article.revision,
      [headingBlock("h1", "Changed"), paragraphBlock("p1", "B")],
    );
    expect(live.status).toBe("published");
    expect(live.blocks[0] && live.blocks[0].type === "heading"
      ? live.blocks[0].data.text
      : "").toBe("Changed");

    const snapshot = version!.snapshot as unknown as ReturnType<
      typeof toArticleSnapshot
    >;
    const publicView = articleFromPublishedSnapshot(live, snapshot);
    expect(isPubliclyVisible(publicView.status)).toBe(true);
    expect(
      publicView.blocks[0] && publicView.blocks[0].type === "heading"
        ? publicView.blocks[0].data.text
        : "",
    ).toBe("Original");
    expect(
      publicView.blocks[1] && publicView.blocks[1].type === "paragraph"
        ? // plain text check via JSON
          JSON.stringify(publicView.blocks[1].data)
        : "",
    ).toMatch(/A/);

    const republished = await publishArticle(
      ports,
      ctx,
      created.id,
      live.revision,
      "v2",
    );
    const v2 = await ports.versions.getById(republished.versionId);
    const after = articleFromPublishedSnapshot(
      republished.article,
      v2!.snapshot as unknown as ReturnType<typeof toArticleSnapshot>,
    );
    expect(
      after.blocks[0] && after.blocks[0].type === "heading"
        ? after.blocks[0].data.text
        : "",
    ).toBe("Changed");
  });

  it("catalog and search documents use published snapshot content not live draft", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createArticleUseCase(ports, ctx, {
      slug: "search-invariant",
      title: "Search Invariant",
      ownerId: "user_1",
      blocks: [paragraphBlock("p1", "PublishedPhraseAlpha")],
    });
    const published = await publishArticle(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    await replaceArticleBlocks(
      ports,
      ctx,
      created.id,
      published.article.revision,
      [paragraphBlock("p1", "DraftPhraseBetaOnly")],
    );

    const version = await ports.versions.getById(published.versionId);
    const live = await ports.articles.getById(created.id);
    const publicArticle = articleFromPublishedSnapshot(
      live!,
      version!.snapshot as unknown as ReturnType<typeof toArticleSnapshot>,
    );

    const { buildSearchDocuments } = await import(
      "@/features/public-content/catalog"
    );
    const docs = buildSearchDocuments([publicArticle], [], [], [], []);
    const blob = JSON.stringify(docs);
    expect(blob).toContain("PublishedPhraseAlpha");
    expect(blob).not.toContain("DraftPhraseBetaOnly");
  });

  it("public filters include archived taxonomy only via published snapshot usage", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const archivedLegacy = await createCategoryUseCase(ports, ctx, {
      slug: "legacy-cat",
      title: "Legacy Cat",
    });
    const draftOnlyCat = await createCategoryUseCase(ports, ctx, {
      slug: "draft-cat",
      title: "Draft Cat",
    });
    const activeCat = await createCategoryUseCase(ports, ctx, {
      slug: "active-cat",
      title: "Active Cat",
    });

    const published = await createArticleUseCase(ports, ctx, {
      slug: "legacy-article",
      title: "Legacy Article",
      ownerId: "user_1",
      categoryIds: [archivedLegacy.id],
      blocks: [paragraphBlock("p1", "Body")],
    });
    const pub = await publishArticle(
      ports,
      ctx,
      published.id,
      published.revision,
      "v1",
    );
    await updateArticleMetadata(ports, ctx, published.id, pub.article.revision, {
      categoryIds: [activeCat.id],
    });

    await createArticleUseCase(ports, ctx, {
      slug: "draft-article",
      title: "Draft Article",
      ownerId: "user_1",
      categoryIds: [draftOnlyCat.id],
    });

    const archived = await archiveCategoryUseCase(
      ports,
      ctx,
      archivedLegacy.id,
      (await ports.categories.getById(archivedLegacy.id))!.revision,
    );
    await archiveCategoryUseCase(
      ports,
      ctx,
      draftOnlyCat.id,
      (await ports.categories.getById(draftOnlyCat.id))!.revision,
    );

    const version = await ports.versions.getById(pub.versionId);
    const live = await ports.articles.getById(published.id);
    const publicArticle = articleFromPublishedSnapshot(
      live!,
      version!.snapshot as unknown as ReturnType<typeof toArticleSnapshot>,
    );

    const draftOnlyArchived = await ports.categories.getById(draftOnlyCat.id);
    expect(draftOnlyArchived).not.toBeNull();

    const page = buildCatalogPage(
      [publicArticle],
      [],
      [archived, draftOnlyArchived!, activeCat],
      [],
      [],
      "2024-06-15T12:00:00.000Z",
      {},
    );

    const optionIds = page.categoryOptions.map((o) => o.id);
    expect(optionIds).toContain(archivedLegacy.id);
    expect(optionIds).not.toContain(draftOnlyCat.id);
    expect(optionIds).not.toContain(activeCat.id);
  });
});
