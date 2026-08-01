import { describe, expect, it } from "vitest";

import {
  deserializeArticle,
  deserializeContentVersion,
  serializeArticle,
  serializeContentVersion,
} from "@/domain/content/serialize";
import { createArticle } from "@/domain/content/article";
import { createContentVersion } from "@/domain/content/versioning";
import { ValidationError } from "@/domain/shared/errors";
import { TEST_NOW, paragraphBlock } from "../builders/content";

describe("serialization", () => {
  it("round-trips article without data loss of key fields", () => {
    const article = createArticle({
      id: "a1",
      slug: "demo",
      title: "Demo",
      summary: "Sum",
      blocks: [paragraphBlock("p1")],
      ownerId: "u1",
      now: TEST_NOW,
    });
    const serialized = serializeArticle(article);
    const restored = deserializeArticle(serialized);
    expect(restored.id).toBe(article.id);
    expect(restored.slug).toBe(article.slug);
    expect(restored.title).toBe(article.title);
    expect(restored.blocks).toHaveLength(1);
    expect(restored.createdAt).toBe(TEST_NOW);
  });

  it("rejects unknown fields and invalid persisted data", () => {
    expect(() =>
      deserializeArticle({
        id: "a1",
        slug: "demo",
        title: "Demo",
        status: "draft",
        blocks: [],
        categoryIds: [],
        tagIds: [],
        audienceIds: [],
        relatedArticleIds: [],
        relatedPromptIds: [],
        relatedVideoIds: [],
        summary: null,
        coverMediaId: null,
        ownerId: null,
        authorId: null,
        source: { type: "portal" },
        currentVersion: null,
        publishedVersion: null,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        publishedAt: null,
        reviewDueAt: null,
        revision: 0,
        hackerField: true,
      }),
    ).toThrow(ValidationError);
  });

  it("round-trips content version", () => {
    const version = createContentVersion({
      id: "ver1",
      entityType: "article",
      entityId: "a1",
      versionNumber: 1,
      snapshot: { title: "Demo", slug: "demo" },
      createdBy: "u1",
      createdAt: TEST_NOW,
    });
    const round = deserializeContentVersion(serializeContentVersion(version));
    expect(round.versionNumber).toBe(1);
    expect(round.snapshot).toEqual({ title: "Demo", slug: "demo" });
  });
});
