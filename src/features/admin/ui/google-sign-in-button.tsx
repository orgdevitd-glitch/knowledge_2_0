"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui";
import {
  clearFirebaseClientSession,
  getFirebaseClientAuth,
  signInWithGoogle,
} from "@/lib/firebase/client";
import { isPublicFirebaseConfigured } from "@/config/public-env";

export function GoogleSignInButton({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (disabledReason) {
    return (
      <Alert tone="warning" title="Вход недоступен">
        {disabledReason}
      </Alert>
    );
  }

  if (!isPublicFirebaseConfigured()) {
    return (
      <Alert tone="warning" title="Вход недоступен">
        Firebase Authentication не настроен для этого окружения.
      </Alert>
    );
  }

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const credential = await signInWithGoogle();
      const idToken = await credential.user.getIdToken();
      const csrfRes = await fetch("/api/auth/csrf", { credentials: "same-origin" });
      if (!csrfRes.ok) {
        throw new Error("csrf");
      }
      const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          csrfToken: csrfJson.csrfToken,
        }),
      });
      await clearFirebaseClientSession();
      if (!sessionRes.ok) {
        setError("Доступ запрещён или сессия не создана.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === "REDIRECT_IN_PROGRESS") {
        return;
      }
      setError("Не удалось войти. Попробуйте снова.");
    } finally {
      setBusy(false);
    }
  }

  // Ensure auth module is loadable (side-effect free check)
  void getFirebaseClientAuth;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <Button type="button" onClick={onClick} disabled={busy}>
        {busy ? "Вход…" : "Войти через Google"}
      </Button>
      {error ? (
        <Alert tone="error" title="Ошибка входа">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
