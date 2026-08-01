import { beforeEach, describe, expect, it } from "vitest";

import {
  archivePrompt,
  createPromptUseCase,
  hidePrompt,
  publishPrompt,
  restoreArchivedPrompt,
  restorePromptVersion,
  updatePrompt,
} from "@/features/content/application/prompt-use-cases";
import { createTestPorts, testCtx } from "../builders/content";

describe("prompt atomicity (memory UoW rollback)", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    ports = createTestPorts();
  });

  it("rolls back create when audit write fails", async () => {
    ports.auditRepo.failNextAppend = new Error("audit fail create");
    await expect(
      createPromptUseCase(ports, ctx, {
        slug: "atomic-create",
        title: "A",
        promptText: "Body",
        ownerId: "user_1",
      }),
    ).rejects.toThrow(/audit fail create/);
    expect(await ports.prompts.getBySlug("atomic-create")).toBeNull();
    expect(ports.promptRepo.size()).toBe(0);
  });

  it("rolls back update when audit write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-update",
      title: "Before",
      promptText: "Body",
      ownerId: "user_1",
    });
    ports.auditRepo.failNextAppend = new Error("audit fail update");
    await expect(
      updatePrompt(ports, ctx, created.id, created.revision, {
        title: "After",
      }),
    ).rejects.toThrow(/audit fail update/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.title).toBe("Before");
    expect(live?.revision).toBe(created.revision);
  });

  it("rolls back publish when version write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-pub-ver",
      title: "P",
      promptText: "Body",
      ownerId: "user_1",
    });
    ports.versionRepo.failNextSave = new Error("version fail");
    await expect(
      publishPrompt(ports, ctx, created.id, created.revision),
    ).rejects.toThrow(/version fail/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.status).toBe("draft");
    expect(live?.publishedVersion).toBeNull();
    expect(live?.revision).toBe(created.revision);
    const events = await ports.auditRepo.listByEntity("prompt", created.id);
    expect(events.some((e) => e.eventType === "content.published")).toBe(false);
  });

  it("rolls back publish when audit write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-pub-aud",
      title: "P",
      promptText: "Body",
      ownerId: "user_1",
    });
    ports.auditRepo.failNextAppend = new Error("audit fail publish");
    await expect(
      publishPrompt(ports, ctx, created.id, created.revision),
    ).rejects.toThrow(/audit fail publish/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.status).toBe("draft");
    expect(live?.publishedVersion).toBeNull();
    const versions = await ports.versionRepo.listByEntity("prompt", created.id);
    expect(versions).toHaveLength(0);
  });

  it("rolls back hide when audit write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-hide",
      title: "H",
      promptText: "Body",
      ownerId: "user_1",
    });
    const pub = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
    );
    ports.auditRepo.failNextAppend = new Error("audit fail hide");
    await expect(
      hidePrompt(ports, ctx, pub.prompt.id, pub.prompt.revision),
    ).rejects.toThrow(/audit fail hide/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.status).toBe("published");
    expect(live?.revision).toBe(pub.prompt.revision);
  });

  it("rolls back archive when audit write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-arch",
      title: "A",
      promptText: "Body",
      ownerId: "user_1",
    });
    ports.auditRepo.failNextAppend = new Error("audit fail archive");
    await expect(
      archivePrompt(ports, ctx, created.id, created.revision),
    ).rejects.toThrow(/audit fail archive/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.status).toBe("draft");
  });

  it("rolls back restore when audit write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-rest",
      title: "R",
      promptText: "Body",
      ownerId: "user_1",
    });
    const archived = await archivePrompt(
      ports,
      ctx,
      created.id,
      created.revision,
    );
    ports.auditRepo.failNextAppend = new Error("audit fail restore");
    await expect(
      restoreArchivedPrompt(ports, ctx, archived.id, archived.revision),
    ).rejects.toThrow(/audit fail restore/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.status).toBe("archived");
  });

  it("rolls back restore version when audit write fails", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "atomic-vrest",
      title: "V1",
      promptText: "One",
      ownerId: "user_1",
    });
    const pub = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    const draft = await updatePrompt(
      ports,
      ctx,
      pub.prompt.id,
      pub.prompt.revision,
      { promptText: "Two", title: "V2" },
    );
    ports.auditRepo.failNextAppend = new Error("audit fail version restore");
    await expect(
      restorePromptVersion(
        ports,
        ctx,
        draft.id,
        pub.versionId,
        draft.revision,
      ),
    ).rejects.toThrow(/audit fail version restore/);
    const live = await ports.prompts.getById(created.id);
    expect(live?.promptText).toBe("Two");
    expect(live?.title).toBe("V2");
    expect(live?.revision).toBe(draft.revision);
  });
});
