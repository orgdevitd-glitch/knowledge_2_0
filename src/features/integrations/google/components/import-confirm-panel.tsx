"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Checkbox, NativeSelect } from "@/components/ui";
import { AdminMutationClientError } from "@/features/admin/articles/client/admin-articles-api";
import { googleIntegrationsApi } from "@/features/integrations/google/client/google-integrations-api";

export function ImportConfirmPanel({
  importJobId,
  importType,
  status,
  expired,
  hasErrors,
}: {
  importJobId: string;
  importType: string;
  status: string;
  expired: boolean;
  hasErrors: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"metadata" | "blocks" | "both">("both");
  const [readyOnly, setReadyOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canConfirm =
    !expired &&
    status === "ready" &&
    (!hasErrors || (importType === "google-sheets-prompts" && readyOnly));

  async function onConfirm() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      if (importType === "google-docs-article") {
        const result = await googleIntegrationsApi.confirm(importJobId, {
          mode,
          createNew: true,
        });
        const articleId = String(
          (result as { articleId?: string }).articleId ?? "",
        );
        setMessage("Импорт подтверждён. Статья создана как черновик.");
        if (articleId) {
          router.push(`/admin/articles/${articleId}/edit`);
          return;
        }
      } else {
        await googleIntegrationsApi.confirm(importJobId, { readyOnly });
        setMessage("Импорт промтов подтверждён. Все записи в статусе draft.");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось подтвердить импорт",
      );
    } finally {
      setPending(false);
    }
  }

  async function onCancel() {
    setPending(true);
    setError(null);
    try {
      await googleIntegrationsApi.cancel(importJobId);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось отменить",
      );
    } finally {
      setPending(false);
    }
  }

  if (status === "confirmed") {
    return <Alert tone="success" title="Импорт подтверждён" />;
  }

  return (
    <section aria-labelledby="confirm-heading" style={{ display: "grid", gap: "0.75rem" }}>
      <h2 id="confirm-heading">Подтверждение</h2>
      {expired ? (
        <Alert tone="warning" title="Preview истёк">
          Создайте новый preview из источника.
        </Alert>
      ) : null}

      {importType === "google-docs-article" ? (
          <NativeSelect
            label="Режим импорта"
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as "metadata" | "blocks" | "both")
            }
            options={[
              { value: "both", label: "Метаданные и блоки" },
              { value: "metadata", label: "Только метаданные" },
              { value: "blocks", label: "Только блоки" },
            ]}
          />
      ) : (
        <Checkbox
          checked={readyOnly}
          onChange={(e) => setReadyOnly(e.target.checked)}
          label="Импортировать только готовые строки (ready/warning)"
        />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Button
          type="button"
          disabled={!canConfirm || pending}
          onClick={() => void onConfirm()}
        >
          {pending ? "…" : "Подтвердить импорт"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || status === "cancelled"}
          onClick={() => void onCancel()}
        >
          Отменить
        </Button>
      </div>
      {message ? <Alert tone="success" title="Готово">{message}</Alert> : null}
      {error ? <Alert tone="error" title="Ошибка">{error}</Alert> : null}
    </section>
  );
}
