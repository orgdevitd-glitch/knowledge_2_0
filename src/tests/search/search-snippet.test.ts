import { describe, expect, it } from "vitest";

import { pickHighlightedSnippet } from "@/features/search/application/snippet";
import { SEARCH_DOCUMENT_SCHEMA_VERSION } from "@/domain/search/search-limits";

describe("pickHighlightedSnippet", () => {
  it("prefers matched body over summary without match", () => {
    const segments = pickHighlightedSnippet(
      {
        title: "Title",
        summary: "A short summary without tokens",
        bodyText: "This body mentions Kubernetes cluster",
        promptText: null,
      },
      ["kubernetes"],
    );
    expect(segments.some((s) => s.match && /kubernetes/i.test(s.text))).toBe(
      true,
    );
  });

  it("uses summary when it contains the match", () => {
    const segments = pickHighlightedSnippet(
      {
        title: "Title",
        summary: "Summary about Kubernetes",
        bodyText: "Also Kubernetes in body",
        promptText: null,
      },
      ["kubernetes"],
    );
    expect(segments.map((s) => s.text).join("")).toMatch(/Summary about/i);
  });

  it("falls back to summary when nothing matches", () => {
    const segments = pickHighlightedSnippet(
      {
        title: "Title alone",
        summary: "Safe summary fallback",
        bodyText: "body",
        promptText: null,
      },
      ["zzzz"],
    );
    expect(segments.map((s) => s.text).join("")).toContain("Safe summary");
    expect(segments.every((s) => !s.match)).toBe(true);
  });
});

describe("SearchDocument schema unchanged", () => {
  it("keeps schemaVersion 2", () => {
    expect(SEARCH_DOCUMENT_SCHEMA_VERSION).toBe(2);
  });
});
