import "server-only";

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

import { getServerEnv } from "@/config/env";

let app: App | null = null;

function resolveStorageBucket(): string | undefined {
  return process.env.MEDIA_GCS_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET;
}

function ensureApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return app;
  }

  const env = getServerEnv();
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId && !env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Firebase Admin is not configured");
  }

  if (env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = env.FIRESTORE_EMULATOR_HOST;
  }

  const storageBucket = resolveStorageBucket();
  const initOptions: {
    credential?: ReturnType<typeof cert>;
    projectId?: string;
    storageBucket?: string;
  } = { projectId: projectId ?? "demo-ckp" };

  if (storageBucket) {
    initOptions.storageBucket = storageBucket;
  }

  if (env.FIREBASE_CLIENT_EMAIL && env.firebasePrivateKeyNormalized) {
    app = initializeApp({
      credential: cert({
        projectId: projectId!,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.firebasePrivateKeyNormalized,
      }),
      ...initOptions,
    });
  } else {
    // Application Default Credentials / emulator
    app = initializeApp(initOptions);
  }
  return app;
}

export function getFirebaseAdminApp(): App {
  return ensureApp();
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(ensureApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  const env = getServerEnv();
  const databaseId = env.FIRESTORE_DATABASE_ID;
  if (databaseId && databaseId !== "(default)") {
    return getFirestore(ensureApp(), databaseId);
  }
  return getFirestore(ensureApp());
}

export function getFirebaseAdminStorage(): Storage {
  return getStorage(ensureApp());
}

/** Test helper — does not delete the global firebase-admin app (unsupported). */
export function resetFirebaseAdminCacheForTests(): void {
  app = null;
}
