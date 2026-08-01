"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, NativeSelect, SearchField } from "@/components/ui";
import { AdminMutationClientError } from "@/features/admin/articles/client/admin-articles-api";
import { googleIntegrationsApi } from "@/features/integrations/google/client/google-integrations-api";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  supported: boolean;
};

export function NewSourceForm() {
  const router = useRouter();
  const formId = useId();
  const [urlOrId, setUrlOrId] = useState("");
  const [targetEntityType, setTargetEntityType] = useState<
    "article" | "prompt-batch" | "none"
  >("none");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [folderId, setFolderId] = useState("root");
  const [folderName, setFolderName] = useState("…");
  const [parentId, setParentId] = useState<string | null>(null);
  const [canGoUp, setCanGoUp] = useState(false);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [query, setQuery] = useState("");
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const [browseStarted, setBrowseStarted] = useState(false);

  const loadFolder = useCallback(async (id: string, q?: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const page = await googleIntegrationsApi.listFolder(id, {
        q: q || undefined,
      });
      setFolderId(page.folderId);
      setFolderName(page.folderName);
      setParentId(page.parentId);
      setCanGoUp(page.canGoUp);
      setItems(page.items);
      setBrowseStarted(true);
    } catch (err) {
      setBrowseError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось открыть папку",
      );
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await googleIntegrationsApi.createSource({
        urlOrId,
        targetEntityType,
      });
      const id = String(result.connection.id);
      router.push(`/admin/integrations/google/sources/${id}`);
    } catch (err) {
      setError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось создать источник",
      );
    } finally {
      setPending(false);
    }
  }

  async function selectFile(item: DriveItem) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      await loadFolder(item.id);
      return;
    }
    if (!item.supported) return;
    setUrlOrId(item.id);
    setTargetEntityType(
      item.mimeType === "application/vnd.google-apps.spreadsheet"
        ? "prompt-batch"
        : "article",
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <form id={formId} onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Ссылка или ID файла Google</span>
          <input
            value={urlOrId}
            onChange={(e) => setUrlOrId(e.target.value)}
            required
            aria-required="true"
            style={{
              padding: "0.6rem 0.75rem",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface)",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <NativeSelect
            label="Тип цели"
            value={targetEntityType}
            onChange={(e) =>
              setTargetEntityType(
                e.target.value as "article" | "prompt-batch" | "none",
              )
            }
            options={[
              { value: "none", label: "Не задано" },
              { value: "article", label: "Статья (Docs)" },
              { value: "prompt-batch", label: "Промты (Sheets)" },
            ]}
          />
        </label>
        <Button type="submit" disabled={pending || !urlOrId.trim()}>
          {pending ? "Проверка…" : "Добавить источник"}
        </Button>
        {error ? <Alert tone="error" title="Ошибка">{error}</Alert> : null}
      </form>

      <section aria-labelledby="drive-browser-heading">
        <h2 id="drive-browser-heading" style={{ marginTop: 0 }}>
          Браузер разрешённой папки
        </h2>
        {!browseStarted ? (
          <Button
            type="button"
            variant="secondary"
            disabled={browseLoading}
            onClick={() => void loadFolder("root")}
          >
            {browseLoading ? "Загрузка…" : "Открыть корневую папку"}
          </Button>
        ) : null}
        {browseStarted ? (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <nav aria-label="Навигация по папкам">
                <ol
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    flexWrap: "wrap",
                  }}
                >
                  <li>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!canGoUp || browseLoading}
                      onClick={() => parentId && void loadFolder(parentId)}
                    >
                      На уровень выше
                    </Button>
                  </li>
                  <li aria-current="location">{folderName}</li>
                </ol>
              </nav>
              <SearchField
                label="Фильтр файлов"
                hideLabel
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Фильтр по названию"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadFolder(folderId, query);
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={browseLoading}
                onClick={() => void loadFolder(folderId, query)}
              >
                Найти
              </Button>
            </div>
            {browseError ? (
              <Alert tone="error" title="Ошибка браузера">
                {browseError}
              </Alert>
            ) : null}
            {browseLoading ? <p>Загрузка…</p> : null}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((item) => (
                <li
                  key={item.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <button
                    type="button"
                    onClick={() => void selectFile(item)}
                    disabled={!item.supported}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.75rem 0",
                      background: "transparent",
                      border: 0,
                      cursor: item.supported ? "pointer" : "not-allowed",
                      opacity: item.supported ? 1 : 0.55,
                      color: "inherit",
                    }}
                  >
                    <strong>{item.name}</strong>
                    <div
                      style={{
                        color: "var(--color-text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {item.mimeType}
                      {item.modifiedTime ? ` · ${item.modifiedTime}` : ""}
                      {!item.supported ? " · не поддерживается" : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
