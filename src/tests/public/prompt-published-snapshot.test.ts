import { describe, expect, it } from "vitest";

import {
  promptFromPublishedSnapshot,
  toPromptSnapshot,
} from "@/domain/content/prompt";
import {
  createPromptUseCase,
  publishPrompt,
  updatePrompt,
} from "@/features/content/application/prompt-use-cases";
import { buildCatalogPage, buildSearchDocuments } from "@/features/public-content/catalog";
import { isPubliclyVisible } from "@/features/public-content/visibility";
import { createTestPorts, testCtx } from "@/tests/builders/content";

describe("prompt published snapshot invariant", () => {
  it("catalog and search use published snapshot not working draft", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "snap-prompt",
      title: "Published Title",
      promptText: "PublishedPhraseAlpha",
      summary: "Published summary",
      ownerId: "user_1",
    });
    const published = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    await updatePrompt(ports, ctx, created.id, published.prompt.revision, {
      title: "Draft Title Only",
      promptText: "DraftPhraseBetaOnly",
      summary: "Draft summary",
    });

    const version = await ports.versions.getById(published.versionId);
    const live = await ports.prompts.getById(created.id);
    const publicPrompt = promptFromPublishedSnapshot(
      live!,
      version!.snapshot as unknown as ReturnType<typeof toPromptSnapshot>,
    );

    expect(isPubliclyVisible(publicPrompt.status)).toBe(true);
    expect(publicPrompt.title).toBe("Published Title");
    expect(publicPrompt.promptText).toBe("PublishedPhraseAlpha");

    const page = buildCatalogPage(
      [],
      [publicPrompt],
      [],
      [],
      [],
      "2024-06-15T12:00:00.000Z",
      { type: "prompt" },
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe("Published Title");
    expect(JSON.stringify(page)).not.toContain("Draft Title Only");

    const docs = buildSearchDocuments([], [publicPrompt], [], [], []);
    const blob = JSON.stringify(docs);
    expect(blob).toContain("PublishedPhraseAlpha");
    expect(blob).not.toContain("DraftPhraseBetaOnly");
  });

  it("hidden and draft prompts are not publicly visible", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const draft = await createPromptUseCase(ports, ctx, {
      slug: "draft-p",
      title: "Draft",
      promptText: "x",
      ownerId: "user_1",
    });
    expect(isPubliclyVisible(draft.status)).toBe(false);

    const published = await publishPrompt(
      ports,
      ctx,
      draft.id,
      draft.revision,
    );
    const { hidePrompt } = await import(
      "@/features/content/application/prompt-use-cases"
    );
    const hidden = await hidePrompt(
      ports,
      ctx,
      published.prompt.id,
      published.prompt.revision,
    );
    expect(isPubliclyVisible(hidden.status)).toBe(false);
  });
});
