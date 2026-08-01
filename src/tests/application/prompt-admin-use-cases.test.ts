import { beforeEach, describe, expect, it } from "vitest";

import {
  archiveCategoryUseCase,
  createCategoryUseCase,
  createTagUseCase,
  archiveTagUseCase,
} from "@/features/content/application/taxonomy-use-cases";
import {
  archivePrompt,
  createPromptUseCase,
  hidePrompt,
  publishPrompt,
  restoreArchivedPrompt,
  restorePromptVersion,
  updatePrompt,
} from "@/features/content/application/prompt-use-cases";
import {
  ConflictError,
  DuplicateSlugError,
  InvalidStatusTransitionError,
  ValidationError,
} from "@/domain/shared/errors";
import { promptFromPublishedSnapshot, toPromptSnapshot } from "@/domain/content/prompt";
import { parseSourceReference } from "@/domain/content/source";
import { createTestPorts, testCtx } from "../builders/content";

describe("prompt admin use cases", () => {
  let ports: ReturnType<typeof createTestPorts>;
  const ctx = testCtx();

  beforeEach(() => {
    ports = createTestPorts();
  });

  it("creates manual draft and rejects duplicate slug", async () => {
    const created = await createPromptUseCase(ports, ctx, {
      slug: "manual-one",
      title: "Manual",
      promptText: "Do the thing",
      ownerId: "user_1",
    });
    expect(created.status).toBe("draft");
    expect(created.source.type).toBe("portal");

    await expect(
      createPromptUseCase(ports, ctx, {
        slug: "manual-one",
        title: "Other",
        promptText: "Other text",
        ownerId: "user_1",
      }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);
  });

  it("keeps imported source provenance on edit and archive", async () => {
    const source = parseSourceReference({
      type: "google-sheets",
      externalId: "row-42",
      lastSyncAt: "2024-06-15T12:00:00.000Z",
    });
    const created = await createPromptUseCase(ports, ctx, {
      slug: "imported",
      title: "Imported",
      promptText: "Sheet prompt",
      ownerId: "user_1",
      source,
    });
    const updated = await updatePrompt(ports, ctx, created.id, created.revision, {
      title: "Imported edited",
      promptText: "Sheet prompt v2",
    });
    expect(updated.source.type).toBe("google-sheets");
    expect(updated.source.externalId).toBe("row-42");

    const archived = await archivePrompt(
      ports,
      ctx,
      updated.id,
      updated.revision,
    );
    expect(archived.source.externalId).toBe("row-42");
    const restored = await restoreArchivedPrompt(
      ports,
      ctx,
      archived.id,
      archived.revision,
    );
    expect(restored.status).toBe("draft");
    expect(restored.source.externalId).toBe("row-42");
  });

  it("preserves linked archived taxonomy and blocks newly added archived", async () => {
    const tag = await createTagUseCase(ports, ctx, {
      slug: "t1",
      title: "Tag One",
    });
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "tax-prompt",
      title: "Tax",
      promptText: "Body",
      ownerId: "user_1",
      tagIds: [tag.id],
    });
    const archivedTag = await archiveTagUseCase(
      ports,
      ctx,
      tag.id,
      tag.revision,
    );
    const kept = await updatePrompt(ports, ctx, prompt.id, prompt.revision, {
      title: "Tax 2",
      tagIds: [archivedTag.id],
    });
    expect(kept.tagIds).toContain(archivedTag.id);

    const other = await createTagUseCase(ports, ctx, {
      slug: "t2",
      title: "Tag Two",
    });
    const archivedOther = await archiveTagUseCase(
      ports,
      ctx,
      other.id,
      other.revision,
    );
    await expect(
      updatePrompt(ports, ctx, kept.id, kept.revision, {
        tagIds: [archivedTag.id, archivedOther.id],
      }),
    ).rejects.toMatchObject({ details: { adminCode: "TAXONOMY_ARCHIVED" } });
  });

  it("publish creates immutable version; working draft stays private until republish", async () => {
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "pub-prompt",
      title: "Pub",
      promptText: "Version one text",
      ownerId: "user_1",
    });
    const pub1 = await publishPrompt(
      ports,
      ctx,
      prompt.id,
      prompt.revision,
      "v1",
    );
    const version1 = await ports.versions.getById(pub1.versionId);
    expect(version1).not.toBeNull();

    const draft = await updatePrompt(
      ports,
      ctx,
      prompt.id,
      pub1.prompt.revision,
      { promptText: "Working draft only", title: "Draft Title" },
    );
    expect(draft.promptText).toBe("Working draft only");

    const live = await ports.prompts.getById(prompt.id);
    const publicView = promptFromPublishedSnapshot(
      live!,
      version1!.snapshot as unknown as ReturnType<typeof toPromptSnapshot>,
    );
    expect(publicView.promptText).toBe("Version one text");
    expect(publicView.title).toBe("Pub");

    const pub2 = await publishPrompt(
      ports,
      ctx,
      prompt.id,
      draft.revision,
      "v2",
    );
    const version2 = await ports.versions.getById(pub2.versionId);
    const after = promptFromPublishedSnapshot(
      pub2.prompt,
      version2!.snapshot as unknown as ReturnType<typeof toPromptSnapshot>,
    );
    expect(after.promptText).toBe("Working draft only");
    expect(after.title).toBe("Draft Title");
    expect(pub2.versionId).not.toBe(pub1.versionId);
  });

  it("hide archive restore and version restore do not auto-publish", async () => {
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "life",
      title: "Life",
      promptText: "Text",
      ownerId: "user_1",
    });
    const published = await publishPrompt(
      ports,
      ctx,
      prompt.id,
      prompt.revision,
    );
    const hidden = await hidePrompt(
      ports,
      ctx,
      published.prompt.id,
      published.prompt.revision,
    );
    expect(hidden.status).toBe("hidden");
    expect(hidden.publishedVersion).toBe(published.versionId);

    const archived = await archivePrompt(
      ports,
      ctx,
      hidden.id,
      hidden.revision,
    );
    expect(archived.status).toBe("archived");

    const restored = await restoreArchivedPrompt(
      ports,
      ctx,
      archived.id,
      archived.revision,
    );
    expect(restored.status).toBe("draft");

    await expect(
      hidePrompt(ports, ctx, restored.id, restored.revision),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);

    const again = await publishPrompt(
      ports,
      ctx,
      restored.id,
      restored.revision,
    );
    const vRestored = await restorePromptVersion(
      ports,
      ctx,
      again.prompt.id,
      published.versionId,
      again.prompt.revision,
    );
    expect(vRestored.status).toBe("draft");
    expect(vRestored.publishedVersion).toBe(again.prompt.publishedVersion);
  });

  it("rejects stale revision conflicts", async () => {
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "conflict",
      title: "Conflict",
      promptText: "Text",
      ownerId: "user_1",
    });
    await updatePrompt(ports, ctx, prompt.id, prompt.revision, {
      title: "Updated",
    });
    await expect(
      updatePrompt(ports, ctx, prompt.id, prompt.revision, { title: "Stale" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects publish without content", async () => {
    await expect(
      createPromptUseCase(ports, ctx, {
        slug: "empty",
        title: "Empty",
        promptText: "   ",
        ownerId: "user_1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("writes audit on create and publish", async () => {
    const prompt = await createPromptUseCase(ports, ctx, {
      slug: "audited",
      title: "Audited",
      promptText: "Body",
      ownerId: "user_1",
    });
    const createdEvents = await ports.auditRepo.listByEntity(
      "prompt",
      prompt.id,
    );
    expect(createdEvents.some((e) => e.eventType === "content.created")).toBe(
      true,
    );
    await publishPrompt(ports, ctx, prompt.id, prompt.revision);
    const events = await ports.auditRepo.listByEntity("prompt", prompt.id);
    expect(events.some((e) => e.eventType === "content.published")).toBe(true);
  });

  it("cannot newly attach archived category on create", async () => {
    const category = await createCategoryUseCase(ports, ctx, {
      slug: "arch-cat",
      title: "Arch Cat",
    });
    await archiveCategoryUseCase(
      ports,
      ctx,
      category.id,
      category.revision,
    );
    await expect(
      createPromptUseCase(ports, ctx, {
        slug: "bad-tax",
        title: "Bad",
        promptText: "Text",
        ownerId: "user_1",
        categoryIds: [category.id],
      }),
    ).rejects.toMatchObject({ details: { adminCode: "TAXONOMY_ARCHIVED" } });
  });
});
