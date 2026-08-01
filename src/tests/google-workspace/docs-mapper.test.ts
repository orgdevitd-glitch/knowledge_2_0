import { describe, expect, it } from "vitest";

import { mapGoogleDocToArticleImportDraft } from "@/features/integrations/google/docs/map-google-doc-to-draft";
import { checksumArticleImportDraft } from "@/features/integrations/google/docs/checksum";
import type { GoogleDocumentDto } from "@/server/google-workspace/ports";

function para(
  text: string,
  style = "NORMAL_TEXT",
  extra: Record<string, unknown> = {},
) {
  return {
    paragraph: {
      paragraphStyle: { namedStyleType: style },
      elements: [
        {
          textRun: {
            content: `${text}\n`,
            textStyle: {},
          },
        },
      ],
      ...extra,
    },
  };
}

describe("mapGoogleDocToArticleImportDraft", () => {
  it("maps title, headings, paragraph, bold, links, lists, table, hr", () => {
    const document: GoogleDocumentDto = {
      id: "doc1",
      title: "Документ тест",
      lists: {
        list1: {
          listProperties: {
            nestingLevels: [{ glyphType: "GLYPH_TYPE_UNSPECIFIED" }],
          },
        },
        list2: {
          listProperties: {
            nestingLevels: [{ glyphType: "DECIMAL" }],
          },
        },
      },
      body: {
        content: [
          para("Заголовок TITLE", "TITLE"),
          para("H1 section", "HEADING_1"),
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
              elements: [
                {
                  textRun: {
                    content: "Bold ",
                    textStyle: { bold: true },
                  },
                },
                {
                  textRun: {
                    content: "and link",
                    textStyle: {
                      italic: true,
                      link: { url: "https://example.com/x" },
                    },
                  },
                },
                { textRun: { content: "\n", textStyle: {} } },
              ],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
              bullet: { listId: "list1", nestingLevel: 0 },
              elements: [{ textRun: { content: "Bullet\n", textStyle: {} } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
              bullet: { listId: "list2", nestingLevel: 0 },
              elements: [{ textRun: { content: "One\n", textStyle: {} } }],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
              elements: [{ horizontalRule: {} }, { textRun: { content: "\n" } }],
            },
          },
          {
            table: {
              tableRows: [
                {
                  tableCells: [
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [
                              { textRun: { content: "A\n", textStyle: {} } },
                            ],
                          },
                        },
                      ],
                    },
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [
                              { textRun: { content: "B\n", textStyle: {} } },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  tableCells: [
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [
                              { textRun: { content: "1\n", textStyle: {} } },
                            ],
                          },
                        },
                      ],
                    },
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [
                              { textRun: { content: "2\n", textStyle: {} } },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const draft = mapGoogleDocToArticleImportDraft(document, {
      documentId: "doc1",
      externalUrl: "https://docs.google.com/document/d/doc1/edit",
    });

    expect(draft.proposedTitle).toBeTruthy();
    expect(draft.proposedSlug).toBeTruthy();
    expect(draft.blocks.some((b) => b.type === "heading")).toBe(true);
    expect(draft.blocks.some((b) => b.type === "paragraph")).toBe(true);
    expect(draft.blocks.some((b) => b.type === "list")).toBe(true);
    expect(draft.blocks.some((b) => b.type === "divider")).toBe(true);
    expect(draft.blocks.some((b) => b.type === "table")).toBe(true);
    expect(checksumArticleImportDraft(draft)).toMatch(/^[a-f0-9]{64}$/);
    expect(checksumArticleImportDraft(draft)).toBe(
      checksumArticleImportDraft(draft),
    );
  });

  it("warns on unsafe links and inline images", () => {
    const document: GoogleDocumentDto = {
      id: "doc2",
      title: "Unsafe",
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
              elements: [
                {
                  textRun: {
                    content: "bad",
                    textStyle: { link: { url: "javascript:alert(1)" } },
                  },
                },
                { inlineObjectElement: { inlineObjectId: "img1" } },
                { textRun: { content: "\n", textStyle: {} } },
              ],
            },
          },
        ],
      },
    };
    const draft = mapGoogleDocToArticleImportDraft(document, {
      documentId: "doc2",
    });
    expect(draft.warnings.some((w) => w.code === "UNSAFE_LINK")).toBe(true);
    expect(draft.unsupportedElements.some((u) => u.kind === "inline-image")).toBe(
      true,
    );
  });
});
