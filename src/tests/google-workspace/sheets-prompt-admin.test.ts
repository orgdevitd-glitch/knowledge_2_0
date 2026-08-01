import { describe, expect, it } from "vitest";

import { parseSourceReference } from "@/domain/content/source";
import {
  createPromptUseCase,
  updatePrompt,
} from "@/features/content/application/prompt-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

describe("Sheets imported prompts in Prompt Admin", () => {
  it("imported draft is editable and keeps SourceReference; old preview stays immutable", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();

    const frozenPreview = {
      items: [
        {
          externalId: "ext-1",
          title: "From Sheet",
          status: "ready" as const,
        },
      ],
    };

    const source = parseSourceReference({
      type: "google-sheets",
      externalId: "ext-1",
      connectionId: "conn_sheet_1",
      lastImportJobId: "job_old",
      lastSyncAt: "2024-06-15T12:00:00.000Z",
    });
    const created = await createPromptUseCase(ports, ctx, {
      slug: "from-sheet",
      title: "From Sheet",
      promptText: "Do X",
      ownerId: "user_1",
      source,
    });
    expect(created.status).toBe("draft");
    expect(created.source.type).toBe("google-sheets");

    const edited = await updatePrompt(
      ports,
      ctx,
      created.id,
      created.revision,
      { promptText: "Do X manually edited", title: "From Sheet edited" },
    );
    expect(edited.revision).toBeGreaterThan(created.revision);
    expect(edited.source.externalId).toBe("ext-1");
    expect(edited.source.connectionId).toBe("conn_sheet_1");
    expect(frozenPreview.items[0]?.status).toBe("ready");
    expect(frozenPreview.items[0]?.title).toBe("From Sheet");

    const match = await ports.prompts.findBySourceExternalId({
      sourceType: "google-sheets",
      connectionId: "conn_sheet_1",
      externalId: "ext-1",
    });
    expect(match?.revision).toBe(edited.revision);
    expect(match?.status).toBe("draft");
  });

  it("findBySourceExternalId is connection-scoped and independent of list limit", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    for (let i = 0; i < 110; i += 1) {
      await createPromptUseCase(ports, ctx, {
        slug: `noise-${i}`,
        title: `N ${i}`,
        promptText: "n",
        ownerId: "user_1",
      });
    }
    const a = await createPromptUseCase(ports, ctx, {
      slug: "sheet-a",
      title: "A",
      promptText: "a",
      ownerId: "user_1",
      source: parseSourceReference({
        type: "google-sheets",
        externalId: "same-ext",
        connectionId: "conn_a",
      }),
    });
    const b = await createPromptUseCase(ports, ctx, {
      slug: "sheet-b",
      title: "B",
      promptText: "b",
      ownerId: "user_1",
      source: parseSourceReference({
        type: "google-sheets",
        externalId: "same-ext",
        connectionId: "conn_b",
      }),
    });
    expect(
      (
        await ports.prompts.findBySourceExternalId({
          sourceType: "google-sheets",
          connectionId: "conn_a",
          externalId: "same-ext",
        })
      )?.id,
    ).toBe(a.id);
    expect(
      (
        await ports.prompts.findBySourceExternalId({
          sourceType: "google-sheets",
          connectionId: "conn_b",
          externalId: "same-ext",
        })
      )?.id,
    ).toBe(b.id);
  });
});
