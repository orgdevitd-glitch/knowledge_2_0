"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Stack } from "@/components/layout";
import { Alert, Button, Input, NativeSelect } from "@/components/ui";

async function getCsrf(): Promise<string> {
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const json = (await res.json()) as { csrfToken?: string };
  if (!json.csrfToken) throw new Error("CSRF missing");
  return json.csrfToken;
}

export function SearchAdminActions() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<"article" | "prompt">("article");
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rebuild = async () => {
    setLoading("rebuild");
    setError(null);
    setMessage(null);
    try {
      const csrfToken = await getCsrf();
      const res = await fetch("/api/admin/search/rebuild", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Rebuild failed");
      }
      setMessage(
        `Rebuild OK: ${json.documentCount} docs (gen ${json.generationId})`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(null);
    }
  };

  const reindex = async () => {
    setLoading("reindex");
    setError(null);
    setMessage(null);
    try {
      const csrfToken = await getCsrf();
      const res = await fetch("/api/admin/search/reindex", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken, entityType, entityId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Reindex failed");
      }
      setMessage(`Reindex: ${json.outcome}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Stack gap={3}>
      {error ? (
        <Alert tone="error" title="Ошибка">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert tone="success" title="Готово">
          {message}
        </Alert>
      ) : null}
      <Button
        variant="primary"
        loading={loading === "rebuild"}
        onClick={rebuild}
      >
        Полный rebuild индекса
      </Button>
      <NativeSelect
        label="Тип сущности"
        value={entityType}
        onChange={(e) =>
          setEntityType(e.target.value as "article" | "prompt")
        }
        options={[
          { value: "article", label: "Article" },
          { value: "prompt", label: "Prompt" },
        ]}
      />
      <Input
        label="Entity ID"
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
      />
      <Button
        variant="outline"
        loading={loading === "reindex"}
        disabled={!entityId.trim()}
        onClick={reindex}
      >
        Reindex entity
      </Button>
    </Stack>
  );
}
