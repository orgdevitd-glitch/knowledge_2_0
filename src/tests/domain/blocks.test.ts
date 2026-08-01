import { describe, expect, it } from "vitest";

import {
  BLOCK_TYPES,
  validateBlock,
  validateBlocks,
  reorderBlocks,
} from "@/domain/content/blocks";
import {
  UnknownBlockTypeError,
  UnsupportedBlockSchemaVersionError,
  ValidationError,
} from "@/domain/shared/errors";
import { richTextFromPlain } from "@/domain/shared/rich-text";
import { blockFixture, headingBlock, paragraphBlock } from "../builders/content";

describe("blocks", () => {
  it("validates every block type of phase 3", () => {
    const samples: Record<(typeof BLOCK_TYPES)[number], unknown> = {
      heading: blockFixture("heading", "b1", { level: 2, text: "H" }),
      paragraph: blockFixture("paragraph", "b2", {
        content: richTextFromPlain("p"),
      }),
      list: blockFixture("list", "b3", {
        style: "unordered",
        items: ["a"],
      }),
      table: blockFixture("table", "b4", {
        columns: ["A", "B"],
        rows: [["1", "2"]],
      }),
      image: blockFixture("image", "b5", {
        mediaId: "m1",
        alt: "alt",
        decorative: false,
      }),
      gallery: blockFixture("gallery", "b6", {
        items: [
          { mediaId: "m1", alt: "a", decorative: false },
          { mediaId: "m2", alt: "b", decorative: false },
        ],
      }),
      video: blockFixture("video", "b7", {
        videoId: "v1",
        title: "Vid",
        autoplay: false,
      }),
      file: blockFixture("file", "b8", {
        mediaId: "m1",
        title: "File",
      }),
      button: blockFixture("button", "b9", {
        label: "Go",
        href: "/x",
        variant: "primary",
        openInNewTab: false,
      }),
      link: blockFixture("link", "b10", {
        label: "L",
        href: "https://example.com",
        linkType: "external",
      }),
      quote: blockFixture("quote", "b11", { text: "q" }),
      info: blockFixture("info", "b12", { body: "i" }),
      warning: blockFixture("warning", "b13", { body: "w" }),
      tip: blockFixture("tip", "b14", { body: "t" }),
      steps: blockFixture("steps", "b15", {
        items: [{ id: "s1", title: "S", description: "D" }],
      }),
      checklist: blockFixture("checklist", "b16", {
        items: [{ id: "c1", text: "item" }],
      }),
      faq: blockFixture("faq", "b17", {
        items: [{ id: "f1", question: "Q?", answer: "A" }],
      }),
      prompt: blockFixture("prompt", "b18", {
        promptId: "p1",
        showTitle: true,
        showCopyButton: true,
      }),
      code: blockFixture("code", "b19", {
        code: "console.log(1)",
        language: "ts",
        executable: false,
      }),
      "related-content": blockFixture("related-content", "b20", {
        items: [{ entityType: "article", entityId: "a1" }],
      }),
      divider: blockFixture("divider", "b21", {}),
      "table-of-contents": blockFixture("table-of-contents", "b22", {
        mode: "auto",
      }),
    };

    for (const type of BLOCK_TYPES) {
      expect(() => validateBlock(samples[type])).not.toThrow();
    }
  });

  it("rejects unknown type and schema version", () => {
    expect(() =>
      validateBlock({
        id: "x",
        type: "magic",
        schemaVersion: 1,
        data: {},
      }),
    ).toThrow(UnknownBlockTypeError);

    expect(() =>
      validateBlock({
        id: "x",
        type: "heading",
        schemaVersion: 99,
        data: { level: 2, text: "H" },
      }),
    ).toThrow(UnsupportedBlockSchemaVersionError);
  });

  it("rejects heading level 1 and unsafe urls", () => {
    expect(() =>
      validateBlock(
        blockFixture("heading", "h", { level: 1, text: "Bad" }),
      ),
    ).toThrow(ValidationError);

    expect(() =>
      validateBlock(
        blockFixture("link", "l", {
          label: "x",
          href: "javascript:alert(1)",
          linkType: "external",
        }),
      ),
    ).toThrow(ValidationError);
  });

  it("rejects bad table rows and gallery duplicates", () => {
    expect(() =>
      validateBlock(
        blockFixture("table", "t", {
          columns: ["A", "B"],
          rows: [["only-one"]],
        }),
      ),
    ).toThrow(ValidationError);

    expect(() =>
      validateBlock(
        blockFixture("gallery", "g", {
          items: [
            { mediaId: "m1", alt: "a", decorative: false },
            { mediaId: "m1", alt: "b", decorative: false },
          ],
        }),
      ),
    ).toThrow(ValidationError);
  });

  it("rejects duplicate block ids and preserves ids on reorder", () => {
    expect(() =>
      validateBlocks([paragraphBlock("same"), headingBlock("same")]),
    ).toThrow(ValidationError);

    const blocks = validateBlocks([
      paragraphBlock("a"),
      headingBlock("b"),
    ]);
    const reordered = reorderBlocks(blocks, ["b", "a"]);
    expect(reordered.map((b) => b.id)).toEqual(["b", "a"]);
    expect(reordered[0]?.type).toBe("heading");
  });
});
