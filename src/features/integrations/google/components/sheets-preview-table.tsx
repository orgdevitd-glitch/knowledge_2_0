"use client";

import { useMemo, useState } from "react";

import { Badge, NativeSelect } from "@/components/ui";

type PreviewRow = Record<string, unknown>;

const FILTERS = [
  { value: "all", label: "Все" },
  { value: "ready", label: "Ready" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "new", label: "Новые" },
  { value: "update", label: "Обновления" },
] as const;

export function SheetsPreviewTable({ items }: { items: PreviewRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const status = String(item.status ?? "");
      const action = String(item.action ?? "");
      switch (filter) {
        case "ready":
          return status === "ready";
        case "warning":
          return status === "warning";
        case "error":
          return status === "error";
        case "new":
          return action === "create";
        case "update":
          return action === "update";
        default:
          return true;
      }
    });
  }, [filter, items]);

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <NativeSelect
        label="Фильтр строк"
        value={filter}
        onChange={(e) =>
          setFilter(e.target.value as (typeof FILTERS)[number]["value"])
        }
        options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
      />
      <div role="table" aria-label="Строки preview">
        {filtered.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>Нет строк для фильтра.</p>
        ) : (
          filtered.slice(0, 50).map((item) => (
            <div
              key={String(item.rowNumber)}
              role="row"
              style={{
                padding: "0.5rem 0",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <Badge>{String(item.status)}</Badge> row {String(item.rowNumber)}:{" "}
              {String(item.title ?? "")}
              {item.action ? ` · ${String(item.action)}` : ""}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
