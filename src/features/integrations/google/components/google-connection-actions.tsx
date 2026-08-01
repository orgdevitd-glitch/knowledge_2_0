"use client";

import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { googleIntegrationsApi } from "@/features/integrations/google/client/google-integrations-api";
import { AdminMutationClientError } from "@/features/admin/articles/client/admin-articles-api";

export function GoogleConnectionActions() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onTest() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const result = await googleIntegrationsApi.testConnection();
      setMessage(`Подключение успешно. Корневая папка: ${result.rootFolderName}`);
    } catch (err) {
      setError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось проверить подключение",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
      <Button type="button" onClick={onTest} disabled={pending}>
        {pending ? "Проверка…" : "Проверить подключение"}
      </Button>
      {message ? <Alert tone="success" title="OK">{message}</Alert> : null}
      {error ? <Alert tone="error" title="Ошибка">{error}</Alert> : null}
    </div>
  );
}
