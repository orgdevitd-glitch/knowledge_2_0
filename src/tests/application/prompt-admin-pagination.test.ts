import { beforeEach, describe, expect, it } from "vitest";

import { ValidationError } from "@/domain/shared/errors";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import { createPromptUseCase } from "@/features/content/application/prompt-use-cases";
import { parseSourceReference } from "@/domain/content/source";
import { encodePromptAdminCursor } from "@/server/repositories/prompt-admin-cursor";
import { createTestPorts, testCtx } from "../builders/content";

describe("prompt admin pagination", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    ports = createTestPorts();
  });

  async function seed(count: number, prefix = "p") {
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const n = String(i).padStart(3, "0");
      created.push(
        await createPromptUseCase(ports, ctx, {
          slug: `${prefix}-${n}`,
          title: `Title ${n}`,
          promptText: `Body ${n}`,
          ownerId: "user_1",
        }),
      );
    }
    return created;
  }

  it("exposes items beyond former 100-limit via next page", async () => {
    await seed(110);
    const page1 = await ports.prompts.listAdmin(
      { sort: "title_asc" },
      { limit: 50 },
    );
    expect(page1.items).toHaveLength(50);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await ports.prompts.listAdmin(
      { sort: "title_asc" },
      { limit: 50, cursor: page1.nextCursor },
    );
    expect(page2.items.length).toBeGreaterThan(0);
    const page3 = await ports.prompts.listAdmin(
      { sort: "title_asc" },
      { limit: 50, cursor: page2.nextCursor },
    );
    const ids = [
      ...page1.items,
      ...page2.items,
      ...page3.items,
    ].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(
      (await ports.prompts.getBySlug("p-100"))!.id,
    );
  });

  it("status filter does not silently drop archived/hidden", async () => {
    const a = await createPromptUseCase(ports, ctx, {
      slug: "st-arch",
      title: "Archived one",
      promptText: "x",
      ownerId: "user_1",
    });
    const { archivePrompt, hidePrompt, publishPrompt } = await import(
      "@/features/content/application/prompt-use-cases"
    );
    const pub = await publishPrompt(ports, ctx, a.id, a.revision);
    const hidden = await hidePrompt(
      ports,
      ctx,
      pub.prompt.id,
      pub.prompt.revision,
    );
    const archived = await archivePrompt(
      ports,
      ctx,
      hidden.id,
      hidden.revision,
    );

    const archivedPage = await ports.prompts.listAdmin(
      { status: "archived", sort: "updatedAt_desc" },
      { limit: 20 },
    );
    expect(archivedPage.items.map((i) => i.id)).toContain(archived.id);

    const hiddenPrompt = await createPromptUseCase(ports, ctx, {
      slug: "st-hid",
      title: "Hidden one",
      promptText: "y",
      ownerId: "user_1",
    });
    const hPub = await publishPrompt(
      ports,
      ctx,
      hiddenPrompt.id,
      hiddenPrompt.revision,
    );
    const hid = await hidePrompt(
      ports,
      ctx,
      hPub.prompt.id,
      hPub.prompt.revision,
    );
    const hiddenPage = await ports.prompts.listAdmin(
      { status: "hidden", sort: "updatedAt_desc" },
      { limit: 20 },
    );
    expect(hiddenPage.items.map((i) => i.id)).toContain(hid.id);
  });

  it("same updatedAt does not skip rows (id tie-breaker)", async () => {
    const now = "2024-06-15T12:00:00.000Z";
    for (let i = 0; i < 5; i += 1) {
      await createPromptUseCase(
        ports,
        { ...ctx, now },
        {
          slug: `tie-${i}`,
          title: `Tie ${i}`,
          promptText: "body",
          ownerId: "user_1",
        },
      );
    }
    const page1 = await ports.prompts.listAdmin(
      { sort: "updatedAt_desc" },
      { limit: 2 },
    );
    const page2 = await ports.prompts.listAdmin(
      { sort: "updatedAt_desc" },
      { limit: 2, cursor: page1.nextCursor },
    );
    const page3 = await ports.prompts.listAdmin(
      { sort: "updatedAt_desc" },
      { limit: 2, cursor: page2.nextCursor },
    );
    const ids = [...page1.items, ...page2.items, ...page3.items].map(
      (p) => p.id,
    );
    expect(new Set(ids).size).toBe(5);
  });

  it("rejects malformed cursor and sort mismatch", async () => {
    await seed(3);
    await expect(
      ports.prompts.listAdmin(
        { sort: "updatedAt_desc" },
        { limit: 2, cursor: "not-a-cursor" },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    const bad = encodePromptAdminCursor({
      sort: "title_asc",
      v: "x",
      id: "prompt_missing",
    });
    await expect(
      ports.prompts.listAdmin(
        { sort: "updatedAt_desc" },
        { limit: 2, cursor: bad },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("sourceType filter is repository-level and page-safe beyond 100", async () => {
    for (let i = 0; i < 105; i += 1) {
      await createPromptUseCase(ports, ctx, {
        slug: `portal-${String(i).padStart(3, "0")}`,
        title: `Portal ${i}`,
        promptText: "p",
        ownerId: "user_1",
      });
    }
    const target = await createPromptUseCase(ports, ctx, {
      slug: "sheet-target-101",
      title: "Sheet Target",
      promptText: "s",
      ownerId: "user_1",
      source: parseSourceReference({
        type: "google-sheets",
        externalId: "ext-101",
        connectionId: "conn_a",
      }),
    });
    const page = await ports.prompts.listAdmin(
      { sourceType: "google-sheets", sort: "updatedAt_desc" },
      { limit: 20 },
    );
    expect(page.items.map((i) => i.id)).toContain(target.id);
    expect(page.items.every((i) => i.source.type === "google-sheets")).toBe(
      true,
    );
  });

  it("page size change is safe via fresh cursor contract", async () => {
    await seed(40, "sz");
    const page20 = await ports.prompts.listAdmin(
      { sort: "title_asc" },
      { limit: 20 },
    );
    expect(page20.limit).toBe(20);
    const page10 = await ports.prompts.listAdmin(
      { sort: "title_asc" },
      { limit: 10, cursor: page20.nextCursor },
    );
    expect(page10.limit).toBe(10);
    const overlap = page20.items.some((a) =>
      page10.items.some((b) => b.id === a.id),
    );
    expect(overlap).toBe(false);
  });

  it("rejects page limit above admin max", async () => {
    await expect(
      ports.prompts.listAdmin(
        {},
        { limit: CONTENT_LIMITS.adminPromptPageMax + 1 },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
