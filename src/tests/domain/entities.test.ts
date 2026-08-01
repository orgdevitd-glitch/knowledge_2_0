import { describe, expect, it } from "vitest";

import {
  createArticle,
  withReorderedBlocks,
} from "@/domain/content/article";
import { createPrompt } from "@/domain/content/prompt";
import { createVideo } from "@/domain/content/video";
import {
  assertNoCategoryCycle,
  createCategory,
  createTag,
  assertUniqueTagTitle,
} from "@/domain/content/taxonomy";
import { ValidationError } from "@/domain/shared/errors";
import { TEST_NOW, headingBlock, paragraphBlock } from "../builders/content";

describe("article domain", () => {
  it("creates draft and rejects empty title", () => {
    const article = createArticle({
      id: "a1",
      slug: "demo",
      title: "Demo",
      now: TEST_NOW,
    });
    expect(article.status).toBe("draft");
    expect(article.publishedAt).toBeNull();

    expect(() =>
      createArticle({
        id: "a2",
        slug: "x",
        title: "",
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });

  it("dedupes taxonomy ids and forbids self-reference", () => {
    const article = createArticle({
      id: "a1",
      slug: "demo",
      title: "Demo",
      categoryIds: ["c1", "c1"],
      now: TEST_NOW,
    });
    expect(article.categoryIds).toEqual(["c1"]);

    expect(() =>
      createArticle({
        id: "a1",
        slug: "demo",
        title: "Demo",
        relatedArticleIds: ["a1"],
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });

  it("reorder preserves block ids", () => {
    const article = createArticle({
      id: "a1",
      slug: "demo",
      title: "Demo",
      blocks: [paragraphBlock("p1"), headingBlock("h1")],
      now: TEST_NOW,
    });
    const next = withReorderedBlocks(article, ["h1", "p1"], TEST_NOW);
    expect(next.blocks.map((b) => b.id)).toEqual(["h1", "p1"]);
    expect(next.revision).toBe(article.revision + 1);
  });
});

describe("prompt domain", () => {
  it("rejects empty promptText", () => {
    expect(() =>
      createPrompt({
        id: "p1",
        slug: "prompt",
        title: "P",
        promptText: "   ",
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });

  it("normalizes related ids", () => {
    const p = createPrompt({
      id: "p1",
      slug: "prompt",
      title: "P",
      promptText: "Do X",
      relatedArticleIds: ["a1", "a1"],
      now: TEST_NOW,
    });
    expect(p.relatedArticleIds).toEqual(["a1"]);
  });
});

describe("video domain", () => {
  it("forbids two sources and negative duration", () => {
    expect(() =>
      createVideo({
        id: "v1",
        slug: "vid",
        title: "V",
        mediaId: "m1",
        externalUrl: "https://example.com/v",
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);

    expect(() =>
      createVideo({
        id: "v1",
        slug: "vid",
        title: "V",
        durationSeconds: -1,
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects unsorted chapters and out-of-range timestamps", () => {
    expect(() =>
      createVideo({
        id: "v1",
        slug: "vid",
        title: "V",
        mediaId: "m1",
        durationSeconds: 10,
        chapters: [
          { title: "B", startSeconds: 5 },
          { title: "A", startSeconds: 1 },
        ],
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);

    expect(() =>
      createVideo({
        id: "v1",
        slug: "vid",
        title: "V",
        mediaId: "m1",
        durationSeconds: 10,
        chapters: [{ title: "Late", startSeconds: 11 }],
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects unsafe external url", () => {
    expect(() =>
      createVideo({
        id: "v1",
        slug: "vid",
        title: "V",
        externalUrl: "http://example.com/v",
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);
  });
});

describe("taxonomy domain", () => {
  it("forbids self-parent and cycles", () => {
    expect(() =>
      createCategory({
        id: "c1",
        slug: "cat",
        title: "Cat",
        parentId: "c1",
        now: TEST_NOW,
      }),
    ).toThrow(ValidationError);

    const root = createCategory({
      id: "c1",
      slug: "root",
      title: "Root",
      now: TEST_NOW,
    });
    const child = createCategory({
      id: "c2",
      slug: "child",
      title: "Child",
      parentId: "c1",
      now: TEST_NOW,
    });
    expect(() =>
      assertNoCategoryCycle([root, child], root.id, child.id),
    ).toThrow(ValidationError);
  });

  it("forbids duplicate tag titles", () => {
    const tag = createTag({
      id: "t1",
      slug: "one",
      title: "Alpha",
      now: TEST_NOW,
    });
    expect(() => assertUniqueTagTitle([tag], " alpha ")).toThrow(
      ValidationError,
    );
  });
});
