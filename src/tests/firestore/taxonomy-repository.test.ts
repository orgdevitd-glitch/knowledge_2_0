/**
 * Firestore taxonomy repository integration tests — require Emulator.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(Boolean(emulatorHost))("Firestore taxonomy repositories", () => {
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
    "persists categories tags audiences with concurrency and hierarchy",
    async () => {
      const { createCategory, createTag, createAudience, moveCategory } =
        await import("@/domain/content/taxonomy");
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );
      const {
        FirestoreCategoryRepository,
        FirestoreTagRepository,
        FirestoreAudienceRepository,
      } = await import(
        "@/server/repositories/firestore/firestore-taxonomy-repository"
      );
      const { ConflictError, DuplicateSlugError } = await import(
        "@/domain/shared/errors"
      );

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const categories = new FirestoreCategoryRepository();
      const tags = new FirestoreTagRepository();
      const audiences = new FirestoreAudienceRepository();

      const root = createCategory({
        id: "cat_root",
        slug: "root",
        title: "Root",
        now,
      });
      await categories.save(root, { expectedRevision: 0 });
      const child = createCategory({
        id: "cat_child",
        slug: "child",
        title: "Child",
        parentId: root.id,
        now,
      });
      await categories.save(child, { expectedRevision: 0 });
      const all = await categories.listAll();
      const moved = moveCategory(child, null, all, now);
      await categories.save(moved, { expectedRevision: child.revision });

      await expect(
        categories.save(moved, { expectedRevision: child.revision }),
      ).rejects.toBeInstanceOf(ConflictError);

      const tag = createTag({
        id: "tag_1",
        slug: "tag-one",
        title: "Tag One",
        now,
      });
      await tags.save(tag, { expectedRevision: 0 });
      await expect(
        tags.save(
          createTag({
            id: "tag_2",
            slug: "tag-one",
            title: "Other",
            now,
          }),
          { expectedRevision: 0 },
        ),
      ).rejects.toBeInstanceOf(DuplicateSlugError);

      const audience = createAudience({
        id: "aud_1",
        slug: "aud-one",
        title: "Audience One",
        sortOrder: 10,
        now,
      });
      await audiences.save(audience, { expectedRevision: 0 });
      const loaded = await audiences.getBySlug("aud-one");
      expect(loaded?.title).toBe("Audience One");
    },
    20_000,
  );
});
