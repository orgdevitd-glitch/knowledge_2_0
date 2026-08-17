"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, EmptyState, NativeSelect, SearchField, Status } from "@/components/ui";
import { Inline } from "@/components/layout";
import { AdminDialog } from "@/features/admin/ui/admin-dialog";
import {
  adminPickerApi,
  isAbortError,
} from "@/features/admin/pickers/client/admin-picker-api";
import { isUnsetReferenceId } from "@/features/admin/pickers/placeholder-id";
import { PICKER_SEARCH_DEBOUNCE_MS } from "@/features/admin/pickers/picker-limits";
import type { PickerMaterialItem } from "@/features/admin/pickers/picker-types";
import { materialStatusLabel } from "@/features/admin/pickers/picker-types";

import styles from "./picker.module.css";

export type RelatedEntityType = "article" | "prompt";

export type RelatedPickerFieldProps = {
  label: string;
  entityType: RelatedEntityType;
  value: string;
  excludeId?: string;
  excludeIds?: readonly string[];
  allowEmpty?: boolean;
  emptyValue?: string;
  onChange: (entityId: string, entityType: RelatedEntityType) => void;
  onRemove?: () => void;
  typeLocked?: boolean;
};

function statusTone(status: string): "success" | "warning" | "error" | "info" {
  if (status === "published") return "success";
  if (status === "draft") return "info";
  if (status === "missing" || status === "archived") return "error";
  return "warning";
}

function typeLabel(type: RelatedEntityType): string {
  return type === "article" ? "Статья" : "Промт";
}

export function RelatedPickerField({
  label,
  entityType,
  value,
  excludeId,
  excludeIds = [],
  allowEmpty = true,
  emptyValue = "",
  onChange,
  onRemove,
  typeLocked = true,
}: RelatedPickerFieldProps) {
  const titleId = useId();
  const searchGen = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PickerMaterialItem[]>([]);
  const [scanLimitExceeded, setScanLimitExceeded] = useState(false);
  const [current, setCurrent] = useState<PickerMaterialItem | null>(null);
  const [unlockedType, setUnlockedType] = useState<RelatedEntityType>(entityType);

  const unset = isUnsetReferenceId(value);
  const shown = unset ? null : current;
  const pickerType = typeLocked ? entityType : unlockedType;
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    if (unset) return;
    const ac = new AbortController();
    const lookup =
      entityType === "article"
        ? adminPickerApi.lookupMaterials({ articleIds: [value] }, ac.signal)
        : adminPickerApi.lookupMaterials({ promptIds: [value] }, ac.signal);
    lookup
      .then((res) => {
        if (ac.signal.aborted) return;
        setCurrent(res.items[0] ?? null);
      })
      .catch((error) => {
        if (ac.signal.aborted || isAbortError(error)) return;
        setCurrent({
          id: value,
          title: "",
          entityType,
          status: "missing",
          summary: null,
          selectable: false,
          unavailable: true,
        });
      });
    return () => {
      ac.abort();
    };
  }, [value, unset, entityType]);

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
    const blocked = [excludeId, ...excludeKey.split(",")]
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id));
    adminPickerApi
      .searchMaterials(
        {
          entityType: pickerType,
          q: debounced,
          excludeId,
          excludeIds: blocked,
        },
        ac.signal,
      )
      .then((res) => {
        if (ac.signal.aborted || gen !== searchGen.current) return;
        const blockedSet = new Set(blocked);
        setResults(
          res.items.filter(
            (item) =>
              item.selectable &&
              item.id !== excludeId &&
              !blockedSet.has(item.id),
          ),
        );
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
  }, [open, debounced, pickerType, excludeId, excludeKey]);

  const close = useCallback(() => {
    searchGen.current += 1;
    setOpen(false);
    setQuery("");
    setDebounced("");
    setLoading(false);
  }, []);

  const openPicker = () => {
    setUnlockedType(entityType);
    setQuery("");
    setDebounced("");
    setLoading(true);
    setOpen(true);
  };

  const select = (item: PickerMaterialItem) => {
    if (!item.selectable) return;
    onChange(item.id, item.entityType);
    close();
  };

  const displayTitle = shown?.title
    ? shown.title
    : unset
      ? "Не выбрано"
      : "Материал недоступен";
  const hasQuery = debounced.trim().length > 0;

  return (
    <div className={styles.field}>
      <span className={styles.label} id={titleId}>
        {label}
      </span>
      <div className={styles.summary} aria-labelledby={titleId}>
        <div className={styles.meta}>
          <p className={styles.title}>{displayTitle}</p>
          <p className={styles.sub}>{typeLabel(entityType)}</p>
          {shown ? (
            <Status
              tone={statusTone(shown.status)}
              label={
                shown.unavailable
                  ? "Материал недоступен"
                  : materialStatusLabel(shown.status)
              }
            />
          ) : null}
          {shown?.summary ? (
            <p className={styles.sub}>{shown.summary}</p>
          ) : null}
        </div>
        <Inline gap={2} wrap>
          <Button size="small" variant="secondary" type="button" onClick={openPicker}>
            Выбрать материал
          </Button>
          {onRemove ? (
            <Button size="small" variant="ghost" type="button" onClick={onRemove}>
              Удалить
            </Button>
          ) : allowEmpty ? (
            <Button
              size="small"
              variant="ghost"
              type="button"
              onClick={() => onChange(emptyValue, entityType)}
              disabled={unset}
            >
              Очистить
            </Button>
          ) : null}
        </Inline>
      </div>

      <AdminDialog
        open={open}
        title="Выбор материала"
        description="Можно выбрать опубликованные статьи и промты по названию."
        wide
        onClose={close}
        footer={
          <Button variant="outline" type="button" onClick={close}>
            Закрыть
          </Button>
        }
      >
        {typeLocked ? null : (
          <NativeSelect
            label="Тип"
            value={pickerType}
            onChange={(e) => {
              setUnlockedType(e.target.value as RelatedEntityType);
              setLoading(true);
            }}
            options={[
              { value: "article", label: "Статья" },
              { value: "prompt", label: "Промт" },
            ]}
          />
        )}
        <SearchField
          label="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          loading={loading}
          placeholder="Название"
        />
        {results.length === 0 && !loading ? (
          <EmptyState
            title={
              hasQuery
                ? "Нет совпадений в текущей выборке"
                : "Подходящих материалов нет"
            }
            description={
              hasQuery
                ? scanLimitExceeded
                  ? "Просмотрена ограниченная выборка, не весь каталог. Уточните запрос."
                  : "Попробуйте другое название. Поиск идёт по ограниченной выборке, не по всей базе."
                : "Опубликуйте статью или промт, чтобы связать его здесь."
            }
          />
        ) : (
          <ul className={styles.list}>
            {results.map((item) => (
              <li key={`${item.entityType}:${item.id}`} className={styles.item}>
                <div className={styles.meta}>
                  <p className={styles.itemTitle}>{item.title}</p>
                  <p className={styles.sub}>
                    {typeLabel(item.entityType)} · {materialStatusLabel(item.status)}
                  </p>
                  {item.summary ? <p className={styles.sub}>{item.summary}</p> : null}
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
            ))}
          </ul>
        )}
        {scanLimitExceeded && results.length > 0 ? (
          <p className={styles.hint}>
            Показаны первые совпадения в ограниченной выборке. Уточните запрос,
            если нужный материал не виден.
          </p>
        ) : null}
      </AdminDialog>
    </div>
  );
}
