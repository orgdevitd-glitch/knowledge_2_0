import { describe, expect, it } from "vitest";

import { parsePromptSheet } from "@/features/integrations/google/sheets/parse-prompt-sheet";
import { resolveTaxonomyTokens } from "@/features/integrations/google/sheets/taxonomy-resolution";

describe("parsePromptSheet", () => {
  it("parses valid Russian headers and rows", () => {
    const result = parsePromptSheet({
      spreadsheetId: "sheet1",
      dataSheetName: "Промты",
      rows: [
        ["Внешний ID", "Название", "Текст промта", "Категории", "Теги"],
        ["ext-1", "Промт один", "Сделай X", "Категория А", "тег1;тег2"],
        ["ext-2", "Промт два", "Сделай Y", "", ""],
      ],
      categories: [
        {
          id: "cat_1",
          name: "Категория А",
          slug: "kategoriya-a",
          status: "active",
        },
      ],
      tags: [
        { id: "tag_1", name: "тег1", slug: "teg1", status: "active" },
        { id: "tag_2", name: "тег2", slug: "teg2", status: "active" },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.status).toBe("ready");
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("flags missing headers and duplicate external_id", () => {
    const result = parsePromptSheet({
      spreadsheetId: "sheet1",
      dataSheetName: "Data",
      rows: [
        ["title", "prompt_text"],
        ["A", "text"],
      ],
    });
    expect(result.errors.some((e) => e.code === "MISSING_REQUIRED_HEADER")).toBe(
      true,
    );

    const dup = parsePromptSheet({
      spreadsheetId: "sheet1",
      dataSheetName: "Data",
      rows: [
        ["external_id", "title", "prompt_text"],
        ["same", "A", "text"],
        ["same", "B", "text2"],
      ],
    });
    expect(dup.items.some((i) => i.errors.some((e) => e.code === "DUPLICATE_EXTERNAL_ID"))).toBe(
      true,
    );
  });

  it("detects slug conflicts in batch and firestore", () => {
    const result = parsePromptSheet({
      spreadsheetId: "sheet1",
      dataSheetName: "Data",
      rows: [
        ["external_id", "title", "prompt_text"],
        ["1", "Same Title", "a"],
        ["2", "Same Title", "b"],
      ],
      existingSlugs: new Set(["other-slug"]),
    });
    expect(
      result.items.some((i) =>
        i.errors.some((e) => e.code === "DUPLICATE_SLUG_BATCH"),
      ),
    ).toBe(true);
  });
});

describe("resolveTaxonomyTokens", () => {
  it("resolves unresolved ambiguous and archived", () => {
    const catalog = [
      { id: "1", name: "Alpha", slug: "alpha", status: "active" as const },
      { id: "2", name: "Alpha", slug: "alpha-2", status: "active" as const },
      { id: "3", name: "Old", slug: "old", status: "archived" as const },
    ];
    expect(resolveTaxonomyTokens(["missing"], catalog)[0]?.status).toBe(
      "unresolved",
    );
    expect(resolveTaxonomyTokens(["Alpha"], catalog)[0]?.status).toBe(
      "ambiguous",
    );
    expect(resolveTaxonomyTokens(["Old"], catalog)[0]?.status).toBe("archived");
  });
});
