import { describe, expect, it } from "vitest";

import { resolveTaxonomyTokens } from "@/features/integrations/google/sheets/taxonomy-resolution";
import {
  archiveCategoryUseCase,
  createCategoryUseCase,
} from "@/features/content/application/taxonomy-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

describe("Sheets taxonomy resolution after Taxonomy Admin", () => {
  it("keeps old preview unresolved while new catalog resolves; archived is not resolved", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();

    const before = resolveTaxonomyTokens(["Новая категория"], []);
    expect(before[0]?.status).toBe("unresolved");

    // Immutable ImportJob preview snapshot is not rewritten when taxonomy changes.
    const frozenPreview = {
      items: [{ token: "Новая категория", status: "unresolved" as const }],
    };

    const category = await createCategoryUseCase(ports, ctx, {
      slug: "novaya-kategoriya",
      title: "Новая категория",
    });

    expect(frozenPreview.items[0]?.status).toBe("unresolved");

    const catalog = (
      await ports.categories.listAll()
    ).map((c) => ({
      id: c.id as string,
      name: c.title as string,
      slug: c.slug as string,
      status: c.status,
    }));
    const after = resolveTaxonomyTokens(["Новая категория"], catalog);
    expect(after[0]?.status).toBe("resolved");
    expect(after[0]?.matchedId).toBe(category.id);

    await archiveCategoryUseCase(
      ports,
      ctx,
      category.id,
      (await ports.categories.getById(category.id))!.revision,
    );
    const archivedCatalog = (await ports.categories.listAll()).map((c) => ({
      id: c.id as string,
      name: c.title as string,
      slug: c.slug as string,
      status: c.status,
    }));
    const archived = resolveTaxonomyTokens(
      ["Новая категория"],
      archivedCatalog,
    );
    expect(archived[0]?.status).toBe("archived");
  });
});
