/**
 * Firestore Media repository + atomic mutation integration tests.
 * Require Emulator + JDK 21+. Run via: npm run test:firestore
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(Boolean(emulatorHost))("Firestore media repository", () => {
  beforeAll(() => {
    process.env.FIREBASE_PROJECT_ID =
      process.env.FIREBASE_PROJECT_ID ?? "demo-ckp";
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.AUTH_MODE = "disabled";
    process.env.PERSISTENCE_MODE = "firestore";
    process.env.MEDIA_STORAGE_MODE = "memory";
  });

  beforeEach(async () => {
    const { resetServerEnvCacheForTests } = await import("@/config/env");
    const { resetMediaEnvCacheForTests } = await import("@/config/media-env");
    const { resetFirebaseAdminCacheForTests } = await import(
      "@/server/firebase/admin"
    );
    resetServerEnvCacheForTests();
    resetMediaEnvCacheForTests();
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
    "saves reads and paginates media with status/kind filters and stable tie-breaker",
    async () => {
      const { createMediaAsset, markMediaReady } = await import(
        "@/domain/content/media"
      );
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );
      const { FirestoreMediaRepository } = await import(
        "@/server/repositories/firestore/firestore-media-repository"
      );
      const { ConflictError } = await import("@/domain/shared/errors");

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const repo = new FirestoreMediaRepository();

      for (let i = 0; i < 5; i += 1) {
        let media = createMediaAsset({
          id: `media_fs_${i}`,
          title: `Media ${i}`,
          kind: i % 2 === 0 ? "image" : "document",
          originalFileName: i % 2 === 0 ? `photo${i}.jpg` : `doc${i}.pdf`,
          storageProvider: "memory",
          storageKey: `media/media_fs_${i}/obj`,
          ownerId: "user_1",
          now,
        });
        if (i % 2 === 0) {
          media = markMediaReady(
            media,
            {
              mimeType: "image/jpeg",
              sizeBytes: 100,
              providerGeneration: "1",
              providerChecksum: null,
              providerEtag: null,
            },
            now,
          );
        }
        await repo.save(media, { expectedRevision: 0 });
      }

      const ready = await repo.listAdmin(
        { status: "ready", sort: "updatedAt_desc" },
        { limit: 10 },
      );
      expect(ready.items.every((m) => m.status === "ready")).toBe(true);

      const images = await repo.listAdmin(
        { kind: "image", sort: "updatedAt_desc" },
        { limit: 10 },
      );
      expect(images.items.every((m) => m.kind === "image")).toBe(true);

      const page1 = await repo.listAdmin(
        { sort: "updatedAt_desc" },
        { limit: 2 },
      );
      expect(page1.nextCursor).toBeTruthy();
      const page2 = await repo.listAdmin(
        { sort: "updatedAt_desc" },
        { limit: 2, cursor: page1.nextCursor },
      );
      const ids = [...page1.items, ...page2.items].map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);

      await expect(
        repo.listAdmin(
          { sort: "updatedAt_desc" },
          { limit: 2, cursor: "not-a-valid-cursor!!!" },
        ),
      ).rejects.toThrow();

      const first = await repo.getById("media_fs_0");
      await expect(
        repo.save(
          { ...first!, title: first!.title, revision: first!.revision },
          { expectedRevision: 999 },
        ),
      ).rejects.toThrow(ConflictError);
    },
    30_000,
  );

  it(
    "runAtomicMediaMutation writes media + multiple audits atomically",
    async () => {
      const { createMediaAsset } = await import("@/domain/content/media");
      const { createAuditEvent } = await import("@/domain/content/audit");
      const { parseIsoDateTime } = await import(
        "@/domain/shared/value-objects"
      );
      const { FirestoreMediaRepository } = await import(
        "@/server/repositories/firestore/firestore-media-repository"
      );
      const { FirestoreUnitOfWork } = await import(
        "@/server/repositories/firestore/firestore-unit-of-work"
      );
      const { getFirebaseAdminFirestore } = await import(
        "@/server/firebase/admin"
      );
      const { FIRESTORE_COLLECTIONS } = await import(
        "@/server/repositories/firestore/collections"
      );
      const { ConflictError } = await import("@/domain/shared/errors");

      const now = parseIsoDateTime("2024-06-15T12:00:00.000Z");
      const media = createMediaAsset({
        id: "media_atomic_1",
        title: "Atomic",
        kind: "image",
        originalFileName: "a.jpg",
        storageProvider: "memory",
        storageKey: "media/media_atomic_1/obj",
        ownerId: "user_1",
        now,
      });
      const audit1 = createAuditEvent({
        id: "audit_media_1",
        eventType: "media.created",
        entityType: "media",
        entityId: media.id,
        actorId: "user_1",
        occurredAt: now,
        metadata: { kind: "image" },
      });
      const audit2 = createAuditEvent({
        id: "audit_media_2",
        eventType: "media.upload.started",
        entityType: "media",
        entityId: media.id,
        actorId: "user_1",
        occurredAt: now,
        metadata: { kind: "image" },
      });

      const uow = new FirestoreUnitOfWork();
      await uow.runAtomicMediaMutation({
        media,
        expectedRevision: 0,
        audits: [audit1, audit2],
      });

      const repo = new FirestoreMediaRepository();
      const saved = await repo.getById(media.id);
      expect(saved?.title).toBe("Atomic");

      const db = getFirebaseAdminFirestore();
      const a1 = await db
        .collection(FIRESTORE_COLLECTIONS.auditEvents)
        .doc(audit1.id)
        .get();
      const a2 = await db
        .collection(FIRESTORE_COLLECTIONS.auditEvents)
        .doc(audit2.id)
        .get();
      expect(a1.exists).toBe(true);
      expect(a2.exists).toBe(true);

      // Stale expectedRevision must conflict.
      await expect(
        uow.runAtomicMediaMutation({
          media: { ...saved!, revision: saved!.revision },
          expectedRevision: 999,
          audits: [
            createAuditEvent({
              id: "audit_stale_rev",
              eventType: "media.metadata.updated",
              entityType: "media",
              entityId: media.id,
              actorId: "user_1",
              occurredAt: now,
            }),
          ],
        }),
      ).rejects.toThrow(ConflictError);

      // Duplicate audit id must conflict.
      await expect(
        uow.runAtomicMediaMutation({
          media: { ...saved!, revision: saved!.revision },
          expectedRevision: saved!.revision,
          audits: [audit1],
        }),
      ).rejects.toThrow(ConflictError);
    },
    30_000,
  );
});
