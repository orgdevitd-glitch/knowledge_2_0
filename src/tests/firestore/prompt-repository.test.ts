/**
 * Firestore Prompt repository integration tests — require Emulator.
 * Run via: npm run test:firestore
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(Boolean(emulatorHost))("Firestore prompt repository", () => {
  beforeAll(() => {
    process.env.FIREBASE_PROJECT_ID =
      process.env.FIREBASE_PROJECT_ID ?? "demo-ckp";
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.AUTH_MODE = "disabled";
    process.env.PERSISTENCE_MODE = "firestore";
  });

  beforeEach(async () => {
    const { resetServerEnvCacheForTests } = await import("@/config/env");
    const { resetFirebaseAdminCacheForTests } = await import(
      "@/server/firebase/admin"
    );
    resetServerEnvCacheForTests();
    resetFirebaseAdminCacheForTests();

    const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-ckp";
    await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
  });

  afterAll(async () => {
    const { resetServerEnvCacheForTests } = await import("@/config/env");
    resetServerEnvCacheForTests();
  });

  it(
    "creates reads updates and rejects stale revision and duplicate slug",
    async () => {
    const { createPrompt, withPromptUpdate } = await import(
      "@/domain/content/prompt"
    );
    const { parseIsoDateTime } = await import("@/domain/shared/value-objects");
    const { FirestorePromptRepository } = await import(
      "@/server/repositories/firestore/firestore-prompt-repository"
    );
    const { ConflictError, DuplicateSlugError } = await import(
      "@/domain/shared/errors"
    );

    const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
    const repo = new FirestorePromptRepository();
    const prompt = createPrompt({
      id: "prompt_1",
      slug: "prompt-one",
      title: "Prompt One",
      promptText: "Do the thing",
      ownerId: "u1",
      now,
    });

    await repo.save(prompt, { expectedRevision: 0 });
    const loaded = await repo.getById("prompt_1");
    expect(loaded?.slug).toBe("prompt-one");
    expect(loaded?.status).toBe("draft");

    const bySlug = await repo.getBySlug("prompt-one");
    expect(bySlug?.id).toBe("prompt_1");

    const updated = withPromptUpdate(
      loaded!,
      { title: "Prompt One Updated" },
      parseIsoDateTime("2024-06-15T13:00:00.000Z"),
    );
    await repo.save(updated, { expectedRevision: loaded!.revision });

    await expect(
      repo.save(updated, { expectedRevision: loaded!.revision }),
    ).rejects.toBeInstanceOf(ConflictError);

    const other = createPrompt({
      id: "prompt_2",
      slug: "prompt-one",
      title: "Other",
      promptText: "Other text",
      ownerId: "u1",
      now,
    });
    await expect(repo.save(other, { expectedRevision: 0 })).rejects.toBeInstanceOf(
      DuplicateSlugError,
    );
  },
  20_000,
  );

  it(
    "lists published only when filtered; draft stays hidden from published list",
    async () => {
    const { createPrompt, markPromptPublished } = await import(
      "@/domain/content/prompt"
    );
    const { parseIsoDateTime } = await import("@/domain/shared/value-objects");
    const { VersionId } = await import("@/domain/shared/ids");
    const { FirestorePromptRepository } = await import(
      "@/server/repositories/firestore/firestore-prompt-repository"
    );

    const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
    const repo = new FirestorePromptRepository();
    const draft = createPrompt({
      id: "prompt_draft",
      slug: "draft-prompt",
      title: "Draft",
      promptText: "secret draft",
      ownerId: "u1",
      now,
    });
    await repo.save(draft, { expectedRevision: 0 });

    let published = createPrompt({
      id: "prompt_pub",
      slug: "published-prompt",
      title: "Published",
      promptText: "public text",
      ownerId: "u1",
      now,
    });
    published = markPromptPublished(
      published,
      VersionId.parse("version_prompt_1"),
      now,
    );
    await repo.save(published, { expectedRevision: 0 });

    const publishedPage = await repo.list(
      { status: "published" },
      { limit: 50 },
    );
    expect(publishedPage.items.map((p) => p.id)).toEqual(["prompt_pub"]);
    expect(publishedPage.items.every((p) => p.status === "published")).toBe(
      true,
    );

    const all = await repo.list({}, { limit: 50 });
    expect(all.items.some((p) => p.id === "prompt_draft")).toBe(true);
  },
  20_000,
  );
});
