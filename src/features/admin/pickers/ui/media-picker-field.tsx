"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, EmptyState, Link, SearchField, Status } from "@/components/ui";
import { Inline } from "@/components/layout";
import { AdminDialog } from "@/features/admin/ui/admin-dialog";
import {
  adminPickerApi,
  isAbortError,
} from "@/features/admin/pickers/client/admin-picker-api";
import { isUnsetReferenceId } from "@/features/admin/pickers/placeholder-id";
import { PICKER_SEARCH_DEBOUNCE_MS } from "@/features/admin/pickers/picker-limits";
import type { PickerMediaItem } from "@/features/admin/pickers/picker-types";
import {
  mediaKindLabel,
  mediaStatusLabel,
  safeMediaPreviewPath,
} from "@/features/admin/pickers/picker-types";

import styles from "./picker.module.css";

export type MediaPickerFieldProps = {
  label: string;
  value: string;
  kind?: "image" | "document";
  allowEmpty?: boolean;
  emptyValue?: string;
  onChange: (mediaId: string) => void;
};

function statusTone(status: string): "success" | "warning" | "error" | "info" {
  if (status === "ready") return "success";
  if (status === "uploading") return "info";
  if (status === "failed" || status === "missing") return "error";
  return "warning";
}

function previewSrc(item: PickerMediaItem): string | null {
  if (item.kind !== "image") return null;
  return safeMediaPreviewPath(item.id, item.publicPath);
}

export function MediaPickerField({
  label,
  value,
  kind,
  allowEmpty = false,
  emptyValue = "",
  onChange,
}: MediaPickerFieldProps) {
  const titleId = useId();
  const searchGen = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PickerMediaItem[]>([]);
  const [scanLimitExceeded, setScanLimitExceeded] = useState(false);
  const [current, setCurrent] = useState<PickerMediaItem | null>(null);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  const unset = isUnsetReferenceId(value);
  const shown = unset ? null : current;

  useEffect(() => {
    if (unset) return;
    const ac = new AbortController();
    adminPickerApi
      .lookupMedia([value], ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        setCurrent(res.items[0] ?? null);
        setHydrateError(null);
      })
      .catch((error) => {
        if (ac.signal.aborted || isAbortError(error)) return;
        setHydrateError("Не удалось загрузить сведения о медиа.");
        setCurrent({
          id: value,
          title: "",
          kind: kind ?? "",
          status: "missing",
          originalFileName: "",
          publicPath: null,
          selectable: false,
          unavailable: true,
        });
      });
    return () => {
      ac.abort();
    };
  }, [value, unset, kind]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setDebounced(query);
      setLoading(true);
    }, PICKER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const gen = ++searchGen.current;
    adminPickerApi
      .searchMedia({ q: debounced, kind }, ac.signal)
      .then((res) => {
        if (ac.signal.aborted || gen !== searchGen.current) return;
        setResults(res.items);
        setScanLimitExceeded(res.scanLimitExceeded);
        setLoading(false);
      })
      .catch((error) => {
        if (ac.signal.aborted || isAbortError(error) || gen !== searchGen.current) {
          return;
        }
        setResults([]);
        setScanLimitExceeded(false);
        setLoading(false);
      });
    return () => {
      ac.abort();
    };
  }, [open, debounced, kind]);

  const close = useCallback(() => {
    searchGen.current += 1;
    setOpen(false);
    setQuery("");
    setDebounced("");
    setLoading(false);
  }, []);

  const openPicker = () => {
    setQuery("");
    setDebounced("");
    setLoading(true);
    setOpen(true);
  };

  const select = (item: PickerMediaItem) => {
    if (!item.selectable) return;
    onChange(item.id);
    close();
  };

  const clear = () => {
    onChange(emptyValue);
  };

  const unavailable = Boolean(shown?.unavailable);
  const displayTitle = shown?.title
    ? shown.title
    : unavailable
      ? "Медиа недоступно"
      : unset
        ? "Не выбрано"
        : "Медиа недоступно";
  const shownPreview = shown ? previewSrc(shown) : null;
  const hasQuery = debounced.trim().length > 0;

  return (
    <div className={styles.field}>
      <span className={styles.label} id={titleId}>
        {label}
      </span>
      <div className={styles.summary} aria-labelledby={titleId}>
        {shownPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.thumb} src={shownPreview} alt="" />
        ) : null}
        <div className={styles.meta}>
          <p className={styles.title}>{displayTitle}</p>
          {shown && !unavailable ? (
            <p className={styles.sub}>
              {mediaKindLabel(shown.kind)}
              {shown.originalFileName ? ` · ${shown.originalFileName}` : ""}
            </p>
          ) : null}
          {shown ? (
            <Status
              tone={statusTone(shown.status)}
              label={
                unavailable
                  ? "Медиа недоступно"
                  : mediaStatusLabel(shown.status)
              }
            />
          ) : null}
          {hydrateError ? (
            <p className={styles.sub} role="status">
              {hydrateError}
            </p>
          ) : null}
        </div>
        <Inline gap={2} wrap>
          <Button size="small" variant="secondary" type="button" onClick={openPicker}>
            Выбрать медиа
          </Button>
          {(allowEmpty || !unset) && (allowEmpty || shown || !unset) ? (
            <Button
              size="small"
              variant="ghost"
              type="button"
              onClick={clear}
              disabled={unset && allowEmpty}
            >
              Очистить
            </Button>
          ) : null}
        </Inline>
      </div>

      <AdminDialog
        open={open}
        title="Выбор медиа"
        description="Выберите готовый файл из медиатеки. Архивированные и незавершённые загрузки недоступны."
        wide
        onClose={close}
        footer={
          <Button variant="outline" type="button" onClick={close}>
            Закрыть
          </Button>
        }
      >
        <SearchField
          label="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          loading={loading}
          placeholder="Название или имя файла"
        />
        {results.length === 0 && !loading ? (
          <EmptyState
            title={hasQuery ? "Нет совпадений в текущей выборке" : "Медиа пока нет"}
            description={
              hasQuery
                ? scanLimitExceeded
                  ? "Просмотрена ограниченная выборка, не вся медиатека. Уточните запрос."
                  : "Попробуйте другое название. Поиск идёт по ограниченной выборке, не по всей базе."
                : kind
                  ? "Загрузите подходящий файл в медиатеке, затем вернитесь к выбору."
                  : "В медиатеке ещё нет готовых файлов."
            }
            primaryAction={
              hasQuery ? undefined : (
                <Link href="/admin/media" variant="standalone">
                  Открыть медиатеку
                </Link>
              )
            }
          />
        ) : (
          <ul className={styles.list}>
            {results.map((item) => {
              const thumb = previewSrc(item);
              return (
                <li key={item.id} className={styles.item}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.thumb} src={thumb} alt="" />
                  ) : null}
                  <div className={styles.meta}>
                    <p className={styles.itemTitle}>{item.title}</p>
                    <p className={styles.sub}>
                      {mediaKindLabel(item.kind)} · {mediaStatusLabel(item.status)}
                      {item.originalFileName ? ` · ${item.originalFileName}` : ""}
                    </p>
                  </div>
                  <Button
                    size="small"
                    type="button"
                    disabled={!item.selectable}
                    onClick={() => select(item)}
                  >
                    Выбрать
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {scanLimitExceeded && results.length > 0 ? (
          <p className={styles.hint}>
            Показаны первые совпадения в ограниченной выборке. Уточните запрос,
            если нужный файл не виден.
          </p>
        ) : null}
      </AdminDialog>
    </div>
  );
}
