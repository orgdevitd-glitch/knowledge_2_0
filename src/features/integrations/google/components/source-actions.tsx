"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { AdminMutationClientError } from "@/features/admin/articles/client/admin-articles-api";
import { googleIntegrationsApi } from "@/features/integrations/google/client/google-integrations-api";

export function SourceActions({
  sourceId,
  archived,
}: {
  sourceId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: "test" | "preview" | "archive") {
    setPending(action);
    setError(null);
    try {
      if (action === "test") {
        await googleIntegrationsApi.testSource(sourceId);
        router.refresh();
      } else if (action === "preview") {
        const result = await googleIntegrationsApi.preview(sourceId);
        router.push(
          `/admin/integrations/google/imports/${result.importJob.id}`,
        );
      } else {
        await googleIntegrationsApi.archive(sourceId);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Операция не выполнена",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      <Button
        type="button"
        variant="secondary"
        disabled={archived || pending !== null}
        onClick={() => void run("test")}
      >
        {pending === "test" ? "…" : "Проверить"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={archived || pending !== null}
        onClick={() => void run("preview")}
      >
        {pending === "preview" ? "…" : "Preview"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={archived || pending !== null}
        onClick={() => void run("archive")}
      >
        Архивировать
      </Button>
      {error ? <Alert tone="error" title="Ошибка">{error}</Alert> : null}
    </div>
  );
}
