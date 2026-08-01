import { describe, expect, it } from "vitest";

import {
  InvalidStatusTransitionError,
  ValidationError,
} from "@/domain/shared/errors";
import {
  assertStatusTransition,
  canTransitionStatus,
} from "@/domain/shared/status";
import {
  parseSlug,
  parseTitle,
  slugify,
} from "@/domain/shared/value-objects";
import { parseSafeUrl } from "@/domain/shared/url";
import {
  richTextFromPlain,
  richTextToPlain,
  parseRichTextDocument,
} from "@/domain/shared/rich-text";

describe("value objects", () => {
  it("parses valid slug", () => {
    expect(parseSlug("hello-world")).toBe("hello-world");
  });

  it("rejects invalid slug", () => {
    expect(() => parseSlug("Hello")).toThrow(ValidationError);
    expect(() => parseSlug("-x")).toThrow(ValidationError);
    expect(() => parseSlug("a--b")).toThrow(ValidationError);
  });

  it("slugify is deterministic and handles cyrillic", () => {
    expect(slugify("Привет мир")).toBe(slugify("Привет мир"));
    expect(slugify("Привет мир")).toBe("privet-mir");
  });

  it("slugify refuses empty result", () => {
    expect(() => slugify("!!!")).toThrow(ValidationError);
  });

  it("rejects empty title", () => {
    expect(() => parseTitle("")).toThrow(ValidationError);
  });
});

describe("status transitions", () => {
  it("allows documented transitions", () => {
    expect(canTransitionStatus("draft", "published")).toBe(true);
    expect(canTransitionStatus("published", "hidden")).toBe(true);
    expect(canTransitionStatus("archived", "draft")).toBe(true);
  });

  it("rejects undocumented transitions", () => {
    expect(() => assertStatusTransition("draft", "hidden")).toThrow(
      InvalidStatusTransitionError,
    );
    expect(() => assertStatusTransition("published", "draft")).toThrow(
      InvalidStatusTransitionError,
    );
  });
});

describe("safe url", () => {
  it("allows relative and https", () => {
    expect(parseSafeUrl("/articles/x")).toBe("/articles/x");
    expect(parseSafeUrl("https://example.com/a")).toContain("https://");
  });

  it("rejects unsafe schemes", () => {
    expect(() => parseSafeUrl("javascript:alert(1)")).toThrow(ValidationError);
    expect(() => parseSafeUrl("data:text/html,hi")).toThrow(ValidationError);
    expect(() => parseSafeUrl("//evil.com")).toThrow(ValidationError);
  });
});

describe("rich text", () => {
  it("round-trips plain text", () => {
    const doc = richTextFromPlain("hello");
    expect(richTextToPlain(doc)).toBe("hello");
  });

  it("rejects raw html-shaped documents without link validation failure", () => {
    expect(() =>
      parseRichTextDocument({
        schemaVersion: 1,
        nodes: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", href: "javascript:alert(1)" }],
          },
        ],
      }),
    ).toThrow(ValidationError);
  });
});
