/**
 * Security Rules tests — require Firestore Emulator.
 * Run via: npm run test:rules
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const [host, portRaw] = (emulatorHost ?? "127.0.0.1:8080").split(":");
const port = Number(portRaw ?? 8080);

describe.runIf(Boolean(emulatorHost))("Firestore security rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(
      join(process.cwd(), "firestore.rules"),
      "utf8",
    );
    testEnv = await initializeTestEnvironment({
      projectId: "demo-ckp-rules",
      firestore: {
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
    await testEnv.clearFirestore();
  });

  it("denies unauthenticated client read/write", async () => {
    const unauth = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauth.collection("articles").doc("a1").get());
    await assertFails(
      unauth.collection("articles").doc("a1").set({ title: "x" }),
    );
  });

  it("denies authenticated client read/write", async () => {
    const auth = testEnv
      .authenticatedContext("user1", { email: "a@b.com" })
      .firestore();
    await assertFails(auth.collection("articles").doc("a1").get());
    await assertFails(
      auth.collection("prompts").doc("p1").set({ title: "x" }),
    );
  });

  it("denies unknown collection access", async () => {
    const auth = testEnv.authenticatedContext("user1").firestore();
    await assertFails(auth.collection("secrets").doc("s1").get());
    expect(true).toBe(true);
  });

  it("denies client access to searchIndexFailures", async () => {
    const auth = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      auth.collection("searchIndexFailures").doc("f1").get(),
    );
    await assertFails(
      auth.collection("searchIndexFailures").doc("f1").set({
        failureCode: "x",
      }),
    );
  });

  it("admin SDK bypass is out of rules scope (smoke)", async () => {
    // Rules tests only cover client SDK. Admin SDK is used by server adapters.
    await assertSucceeds(
      testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("articles").doc("seed").set({
          ok: true,
        });
      }),
    );
  });
});
