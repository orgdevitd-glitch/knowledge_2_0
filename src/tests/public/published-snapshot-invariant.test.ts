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
} from "@/features/content/application/article-use-cases";
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
});
