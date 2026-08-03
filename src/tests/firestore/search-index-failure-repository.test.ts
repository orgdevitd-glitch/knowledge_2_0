/**
 * Firestore SearchIndexFailure repository integration tests.
 * Require Emulator + JDK 21+. Run via: npm run test:firestore
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(Boolean(emulatorHost))(
  "Firestore search index failure repository",
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

    it("saves lists and resolves failures without provider internals", async () => {
      const { FirestoreSearchIndexFailureRepository } = await import(
        "@/server/repositories/firestore/firestore-search-index-failure-repository"
      );
      const repo = new FirestoreSearchIndexFailureRepository();
      const now = "2024-06-15T12:00:00.000Z";
      await repo.save({
        id: "searchfail_1",
        entityType: "article",
        entityId: "a1",
        operation: "upsert",
        sourceRevision: 3,
        versionId: "ver_1",
        failureCode: "SEARCH_INDEX_UNAVAILABLE",
        occurredAt: now,
        updatedAt: now,
        attemptCount: 1,
        resolvedAt: null,
        requestId: "req_1",
      });

      const open = await repo.findOpenForEntity("article", "a1");
      expect(open?.failureCode).toBe("SEARCH_INDEX_UNAVAILABLE");
      expect(JSON.stringify(open)).not.toMatch(/gs:\/\//);
      expect(JSON.stringify(open)).not.toMatch(/bucket/i);

      const listed = await repo.listUnresolved(10);
      expect(listed).toHaveLength(1);

      await repo.save({
        ...open!,
        resolvedAt: "2024-06-15T13:00:00.000Z",
        updatedAt: "2024-06-15T13:00:00.000Z",
      });
      expect(await repo.listUnresolved(10)).toHaveLength(0);
    });
  },
);
