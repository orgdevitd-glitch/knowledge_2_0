import "server-only";

import { getContentSourceMode, getServerEnv } from "@/config/env";
import { DemoPublicContentSource } from "@/server/content-sources/demo/demo-public-content-source";
import { EmptyPublicContentSource } from "@/server/content-sources/empty-public-content-source";
import { FirestorePublicContentSource } from "@/server/content-sources/firestore-public-content-source";
import type { PublicContentSource } from "@/server/content-sources/public-content-source";
import { SystemClock, type Clock } from "@/domain/shared/clock";

let cachedSource: PublicContentSource | null = null;

export function isFirestoreConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_PROJECT_ID);
}

export function getPublicContentSource(): PublicContentSource {
  if (cachedSource) return cachedSource;
  const mode = getContentSourceMode();
  if (mode === "demo") {
    cachedSource = new DemoPublicContentSource();
  } else if (mode === "firestore") {
    if (!isFirestoreConfigured()) {
      throw new Error(
        "CONTENT_SOURCE_MODE=firestore requires Firebase/Firestore configuration",
      );
    }
    cachedSource = new FirestorePublicContentSource();
  } else {
    cachedSource = new EmptyPublicContentSource();
  }
  return cachedSource;
}

export function getPublicClock(): Clock {
  return new SystemClock();
}

export function resetPublicContentCompositionForTests(): void {
  cachedSource = null;
}

export function setPublicContentSourceForTests(
  source: PublicContentSource,
): void {
  cachedSource = source;
}
