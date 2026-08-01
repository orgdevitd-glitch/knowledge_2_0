/**
 * Firestore SourceConnection / ImportJob / Idempotency integration tests.
 * Run via: npm run test:firestore
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(Boolean(emulatorHost))(
  "Firestore integration repositories (Phase 6A)",
  () => {
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

    it("persists SourceConnection with optimistic concurrency", async () => {
      const { parseSourceConnection } = await import(
        "@/domain/integrations/source-connection"
      );
      const { FirestoreSourceConnectionRepository } = await import(
        "@/server/repositories/firestore/firestore-source-connection-repository"
      );
      const { ConflictError } = await import("@/domain/shared/errors");

      const repo = new FirestoreSourceConnectionRepository();
      const connection = parseSourceConnection({
        id: "src_1",
        provider: "google-workspace",
        sourceType: "google-docs",
        externalId: "external-file-123456",
        sharedDriveId: "shared-drive-1234567890",
        rootFolderId: "root-folder-1234567890",
        targetEntityType: "article",
        targetEntityId: null,
        displayName: "Doc",
        mimeType: "application/vnd.google-apps.document",
        status: "active",
        lastKnownModifiedAt: null,
        lastKnownVersion: "1",
        lastImportedChecksum: null,
        lastImportedAt: null,
        createdBy: "user_1",
        createdAt: "2024-06-15T12:00:00.000Z",
        updatedAt: "2024-06-15T12:00:00.000Z",
        revision: 0,
      });
      await repo.save(connection, 0);
      const loaded = await repo.getById("src_1");
      expect(loaded?.externalId).toBe("external-file-123456");
      expect(JSON.stringify(loaded)).not.toMatch(/token|credential|private_key/i);

      const next = parseSourceConnection({
        ...loaded!,
        displayName: "Doc 2",
        revision: 1,
        updatedAt: "2024-06-15T13:00:00.000Z",
      });
      await repo.save(next, 0);
      await expect(repo.save(next, 0)).rejects.toBeInstanceOf(ConflictError);
    });

    it("persists ImportJob and idempotency record", async () => {
      const { parseImportJob } = await import(
        "@/domain/integrations/import-job"
      );
      const { FirestoreImportJobRepository } = await import(
        "@/server/repositories/firestore/firestore-import-job-repository"
      );
      const { FirestoreIdempotencyRepository } = await import(
        "@/server/repositories/firestore/firestore-idempotency-repository"
      );

      const jobs = new FirestoreImportJobRepository();
      const job = parseImportJob({
        id: "import_1",
        sourceConnectionId: "src_1",
        sourceExternalId: "external-file-123456",
        sourceVersion: "1",
        sourceModifiedAt: "2024-06-15T12:00:00.000Z",
        sourceChecksum: "abc",
        importType: "google-docs-article",
        targetEntityType: "article",
        targetEntityId: null,
        status: "ready",
        preview: { kind: "google-docs-article" },
        warnings: [],
        errors: [],
        createdBy: "user_1",
        createdAt: "2024-06-15T12:00:00.000Z",
        expiresAt: "2024-06-15T13:00:00.000Z",
        confirmedAt: null,
        confirmedBy: null,
        resultEntityIds: [],
        idempotencyKey: null,
      });
      await jobs.save(job);
      expect((await jobs.getById("import_1"))?.status).toBe("ready");

      const idem = new FirestoreIdempotencyRepository();
      const first = await idem.saveIfAbsent({
        idempotencyKey: "job|ext|1|article|create-new|confirm-docs:both",
        operation: "confirm-docs",
        result: { articleId: "article_1" },
        createdAt: "2024-06-15T12:00:00.000Z",
      });
      expect(first.created).toBe(true);
      const second = await idem.saveIfAbsent({
        idempotencyKey: "job|ext|1|article|create-new|confirm-docs:both",
        operation: "confirm-docs",
        result: { articleId: "article_other" },
        createdAt: "2024-06-15T12:01:00.000Z",
      });
      expect(second.created).toBe(false);
      expect(second.record.result.articleId).toBe("article_1");
    });
  },
);
