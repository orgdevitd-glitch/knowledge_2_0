"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type UserCredential,
} from "firebase/auth";

import { getPublicEnv, isPublicFirebaseConfigured } from "@/config/public-env";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseClientApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK is browser-only");
  }
  if (!isPublicFirebaseConfigured()) {
    throw new Error("Firebase client is not configured");
  }
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }
  const env = getPublicEnv();
  app = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  });
  return app;
}

export async function getFirebaseClientAuth(): Promise<Auth> {
  if (auth) return auth;
  const instance = getAuth(getFirebaseClientApp());
  // Session-tab only — not long-lived local persistence. Cleared after session cookie exchange.
  await setPersistence(instance, browserSessionPersistence);
  auth = instance;
  return instance;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const instance = await getFirebaseClientAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await signInWithPopup(instance, provider);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(instance, provider);
      throw new Error("REDIRECT_IN_PROGRESS");
    }
    throw error;
  }
}

export async function clearFirebaseClientSession(): Promise<void> {
  if (!isPublicFirebaseConfigured()) return;
  try {
    const instance = await getFirebaseClientAuth();
    await signOut(instance);
  } catch {
    // best-effort
  }
}
