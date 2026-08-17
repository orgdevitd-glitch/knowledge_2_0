import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { updatePromptBodySchema } from "@/features/admin/prompts/schemas/mutation-schemas";
import { createPromptUseCase } from "@/features/content/application/prompt-use-cases";
import { updatePrompt } from "@/features/content/application/prompt-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

const csrfToken = "c".repeat(24);

describe("prompt relatedArticleIds 8E.1 semantics", () => {
  it("does not default an absent relatedArticleIds field to []", () => {
    const parsed = updatePromptBodySchema.parse({
      csrfToken,
      expectedRevision: 1,
      title: "Only title",
    });
    expect(parsed.relatedArticleIds).toBeUndefined();
  });

  it("keeps an explicit empty array as a clear", () => {
    const parsed = updatePromptBodySchema.parse({
      csrfToken,
      expectedRevision: 1,
      relatedArticleIds: [],
    });
    expect(parsed.relatedArticleIds).toEqual([]);
  });

  it("hydrates existing related ids into the editor fields", () => {
    const editor = readFileSync(
      join(
        process.cwd(),
        "src/features/admin/prompts/components/prompt-editor.tsx",
      ),
      "utf8",
    );
    expect(editor).toMatch(/relatedArticleIds: \[\.\.\.prompt\.relatedArticleIds\]/);
  });

  it("preserves relatedArticleIds when an unrelated field is patched", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "keep-rel",
      title: "Original",
      promptText: "Text",
      ownerId: "user_1",
      relatedArticleIds: ["a1"],
    });
    const updated = await updatePrompt(ports, ctx, prompt.id, prompt.revision, {
      title: "Renamed only",
    });
    expect(updated.title).toBe("Renamed only");
    expect(updated.relatedArticleIds).toEqual(["a1"]);
  });
});
