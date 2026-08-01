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

  it(
    "atomic publish creates version and keeps working draft private until republish",
    async () => {
      const { createTestPorts, testCtx } = await import(
        "@/tests/builders/content"
      );
      const {
        createPromptUseCase,
        publishPrompt,
        updatePrompt,
        hidePrompt,
        archivePrompt,
        restoreArchivedPrompt,
      } = await import("@/features/content/application/prompt-use-cases");
      const { FirestorePromptRepository } = await import(
        "@/server/repositories/firestore/firestore-prompt-repository"
      );
      const { FirestoreVersionRepository } = await import(
        "@/server/repositories/firestore/firestore-version-repository"
      );
      const { FirestoreAuditRepository } = await import(
        "@/server/repositories/firestore/firestore-audit-repository"
      );
      const { FirestoreUnitOfWork } = await import(
        "@/server/repositories/firestore/firestore-unit-of-work"
      );
      const { FixedClock } = await import("@/domain/shared/clock");
      const { SequentialIdGenerator } = await import(
        "@/domain/shared/id-generator"
      );
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );
      const { promptFromPublishedSnapshot } = await import(
        "@/domain/content/prompt"
      );

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const base = createTestPorts();
      const ports = {
        ...base,
        prompts: new FirestorePromptRepository(),
        versions: new FirestoreVersionRepository(),
        audit: new FirestoreAuditRepository(),
        uow: new FirestoreUnitOfWork(),
        clock: new FixedClock(now),
        ids: new SequentialIdGenerator(),
      };
      const ctx = testCtx();

      const created = await createPromptUseCase(ports, ctx, {
        slug: "fs-publish",
        title: "FS Publish",
        promptText: "Public v1",
        ownerId: "user_1",
      });
      const pub = await publishPrompt(
        ports,
        ctx,
        created.id,
        created.revision,
        "v1",
      );
      expect(pub.prompt.status).toBe("published");
      expect(pub.prompt.publishedVersion).toBe(pub.versionId);

      const version = await ports.versions.getById(pub.versionId);
      expect(version?.entityType).toBe("prompt");

      const draft = await updatePrompt(
        ports,
        ctx,
        created.id,
        pub.prompt.revision,
        { promptText: "Private draft" },
      );
      const live = await ports.prompts.getById(created.id);
      const publicView = promptFromPublishedSnapshot(
        live!,
        version!.snapshot as never,
      );
      expect(publicView.promptText).toBe("Public v1");
      expect(draft.promptText).toBe("Private draft");

      const hidden = await hidePrompt(
        ports,
        ctx,
        draft.id,
        draft.revision,
      );
      expect(hidden.status).toBe("hidden");
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

      const events = await ports.audit.listByEntity("prompt", created.id);
      expect(events.some((e) => e.eventType === "content.published")).toBe(
        true,
      );
    },
    30_000,
  );

  it(
    "admin cursor pagination returns item beyond first page without duplicates",
    async () => {
      const { createPrompt } = await import("@/domain/content/prompt");
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );
      const { FirestorePromptRepository } = await import(
        "@/server/repositories/firestore/firestore-prompt-repository"
      );

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const repo = new FirestorePromptRepository();
      for (let i = 0; i < 25; i += 1) {
        const n = String(i).padStart(2, "0");
        await repo.save(
          createPrompt({
            id: `prompt_page_${n}`,
            slug: `page-${n}`,
            title: `Page ${n}`,
            promptText: "body",
            ownerId: "u1",
            now,
          }),
          { expectedRevision: 0 },
        );
      }

      const page1 = await repo.listAdmin(
        { sort: "title_asc" },
        { limit: 10 },
      );
      expect(page1.items).toHaveLength(10);
      expect(page1.nextCursor).toBeTruthy();
      const page2 = await repo.listAdmin(
        { sort: "title_asc" },
        { limit: 10, cursor: page1.nextCursor },
      );
      const page3 = await repo.listAdmin(
        { sort: "title_asc" },
        { limit: 10, cursor: page2.nextCursor },
      );
      const ids = [
        ...page1.items,
        ...page2.items,
        ...page3.items,
      ].map((p) => p.id);
      expect(new Set(ids).size).toBe(25);
      expect(ids).toContain("prompt_page_20");
    },
    60_000,
  );

  it(
    "findBySourceExternalId is connection-scoped in Firestore",
    async () => {
      const { createPrompt } = await import("@/domain/content/prompt");
      const { parseSourceReference } = await import(
        "@/domain/content/source"
      );
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );
      const { FirestorePromptRepository } = await import(
        "@/server/repositories/firestore/firestore-prompt-repository"
      );

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const repo = new FirestorePromptRepository();
      await repo.save(
        createPrompt({
          id: "prompt_src_a",
          slug: "src-a",
          title: "A",
          promptText: "a",
          ownerId: "u1",
          now,
          source: parseSourceReference({
            type: "google-sheets",
            externalId: "ext-shared",
            connectionId: "conn_a",
          }),
        }),
        { expectedRevision: 0 },
      );
      await repo.save(
        createPrompt({
          id: "prompt_src_b",
          slug: "src-b",
          title: "B",
          promptText: "b",
          ownerId: "u1",
          now,
          source: parseSourceReference({
            type: "google-sheets",
            externalId: "ext-shared",
            connectionId: "conn_b",
          }),
        }),
        { expectedRevision: 0 },
      );

      const foundA = await repo.findBySourceExternalId({
        sourceType: "google-sheets",
        connectionId: "conn_a",
        externalId: "ext-shared",
      });
      const foundB = await repo.findBySourceExternalId({
        sourceType: "google-sheets",
        connectionId: "conn_b",
        externalId: "ext-shared",
      });
      expect(foundA?.id).toBe("prompt_src_a");
      expect(foundB?.id).toBe("prompt_src_b");
      expect(foundA?.source.externalId).toBe("ext-shared");
    },
    30_000,
  );

  it(
    "Firestore atomic mutation rolls back when audit id already exists",
    async () => {
      const { createPrompt, withPromptUpdate } = await import(
        "@/domain/content/prompt"
      );
      const { createAuditEvent } = await import("@/domain/content/audit");
      const { FirestorePromptRepository } = await import(
        "@/server/repositories/firestore/firestore-prompt-repository"
      );
      const { FirestoreAuditRepository } = await import(
        "@/server/repositories/firestore/firestore-audit-repository"
      );
      const { FirestoreUnitOfWork } = await import(
        "@/server/repositories/firestore/firestore-unit-of-work"
      );
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const prompts = new FirestorePromptRepository();
      const audit = new FirestoreAuditRepository();
      const uow = new FirestoreUnitOfWork();

      const created = createPrompt({
        id: "prompt_fs_rollback",
        slug: "fs-rollback",
        title: "Before",
        promptText: "Body",
        ownerId: "u1",
        now,
      });
      await prompts.save(created, { expectedRevision: 0 });

      const collisionId = "audit_fs_collision";
      await audit.append(
        createAuditEvent({
          id: collisionId,
          eventType: "content.updated",
          entityType: "prompt",
          entityId: created.id,
          actorId: "user_1",
          occurredAt: now,
          metadata: { requestId: "pre" },
        }),
      );

      const next = withPromptUpdate(
        created,
        { title: "After" },
        parseIsoDateTime("2024-06-15T13:00:00.000Z"),
      );
      await expect(
        uow.runAtomicPromptMutation!({
          prompt: next,
          expectedRevision: created.revision,
          audit: createAuditEvent({
            id: collisionId,
            eventType: "content.updated",
            entityType: "prompt",
            entityId: created.id,
            actorId: "user_1",
            occurredAt: now,
            metadata: { requestId: "fail" },
          }),
        }),
      ).rejects.toBeTruthy();

      const live = await prompts.getById(created.id);
      expect(live?.title).toBe("Before");
      expect(live?.revision).toBe(created.revision);
    },
    30_000,
  );
});
