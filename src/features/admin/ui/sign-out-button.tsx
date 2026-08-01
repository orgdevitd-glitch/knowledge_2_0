"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { clearFirebaseClientSession } from "@/lib/firebase/client";

export function AdminSignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      const csrfRes = await fetch("/api/auth/csrf", { credentials: "same-origin" });
      const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
      await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken: csrfJson.csrfToken }),
      });
      await clearFirebaseClientSession();
      router.replace("/admin/sign-in");
      router.refresh();
    } catch {
      router.replace("/admin/sign-in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={onSignOut} disabled={busy}>
      {busy ? "Выход…" : "Выйти"}
    </Button>
  );
}
