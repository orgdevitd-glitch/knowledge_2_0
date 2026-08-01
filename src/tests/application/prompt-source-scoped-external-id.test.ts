import { describe, expect, it } from "vitest";

import { parseSourceReference } from "@/domain/content/source";
import { createPromptUseCase } from "@/features/content/application/prompt-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

describe("source-scoped external id uniqueness", () => {
  it("same externalId in two SourceConnections does not collide", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const a = await createPromptUseCase(ports, ctx, {
      slug: "conn-a",
      title: "A",
      promptText: "A",
      ownerId: "user_1",
      source: parseSourceReference({
        type: "google-sheets",
        externalId: "shared-ext",
        connectionId: "conn_1",
      }),
    });
    const b = await createPromptUseCase(ports, ctx, {
      slug: "conn-b",
      title: "B",
      promptText: "B",
      ownerId: "user_1",
      source: parseSourceReference({
        type: "google-sheets",
        externalId: "shared-ext",
        connectionId: "conn_2",
      }),
    });
    expect(a.id).not.toBe(b.id);
    expect(
      await ports.prompts.findBySourceExternalId({
        sourceType: "google-sheets",
        connectionId: "conn_1",
        externalId: "shared-ext",
      }),
    ).toMatchObject({ id: a.id });
    expect(
      await ports.prompts.findBySourceExternalId({
        sourceType: "google-sheets",
        connectionId: "conn_2",
        externalId: "shared-ext",
      }),
    ).toMatchObject({ id: b.id });
  });

  it("lookup finds prompt beyond truncated list window", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    for (let i = 0; i < 120; i += 1) {
      await createPromptUseCase(ports, ctx, {
        slug: `noise-${String(i).padStart(3, "0")}`,
        title: `Noise ${i}`,
        promptText: "n",
        ownerId: "user_1",
      });
    }
    const target = await createPromptUseCase(ports, ctx, {
      slug: "deep-import",
      title: "Deep",
      promptText: "imported",
      ownerId: "user_1",
      source: parseSourceReference({
        type: "google-sheets",
        externalId: "deep-ext",
        connectionId: "conn_deep",
      }),
    });
    const found = await ports.prompts.findBySourceExternalId({
      sourceType: "google-sheets",
      connectionId: "conn_deep",
      externalId: "deep-ext",
    });
    expect(found?.id).toBe(target.id);
  });

  it("manual prompt may omit externalId", async () => {
    const ports = createTestPorts();
    const created = await createPromptUseCase(ports, testCtx(), {
      slug: "no-ext",
      title: "Manual",
      promptText: "x",
      ownerId: "user_1",
    });
    expect(created.source.externalId).toBeUndefined();
    expect(
      await ports.prompts.findBySourceExternalId({
        sourceType: "portal",
        connectionId: "any",
        externalId: "x",
      }),
    ).toBeNull();
  });
});
