/**
 * Storage Security Rules tests — require Storage Emulator.
 * Run via: npm run test:rules (emulators: firestore,storage)
 *
 * If FIREBASE_STORAGE_EMULATOR_HOST is unset, these tests are skipped.
 * Static deny-all coverage also lives in media-boundaries architecture tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

describe.runIf(Boolean(storageHost))("Storage security rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, portRaw] = (storageHost ?? "127.0.0.1:9199").split(":");
    const port = Number(portRaw ?? 9199);
    const rules = readFileSync(join(process.cwd(), "storage.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: "demo-ckp-storage-rules",
      storage: {
        host,
        port,
        rules,
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearStorage();
  });

  it("denies unauthenticated client read/write", async () => {
    const unauth = testEnv.unauthenticatedContext().storage();
    await assertFails(unauth.ref("media/x/y").getDownloadURL());
    await assertFails(
      unauth.ref("media/x/y").put(new Uint8Array([1, 2, 3])) as unknown as Promise<unknown>,
    );
  });

  it("denies authenticated client read/write", async () => {
    const auth = testEnv.authenticatedContext("user1").storage();
    await assertFails(auth.ref("media/x/y").getDownloadURL());
    await assertFails(
      auth.ref("media/x/y").put(new Uint8Array([1, 2, 3])) as unknown as Promise<unknown>,
    );
    expect(true).toBe(true);
  });
});
