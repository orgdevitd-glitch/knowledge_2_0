"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui";
import type { TaxonomyUsageSummary } from "@/features/admin/taxonomy/types";

import styles from "./taxonomy.module.css";

export type ArchiveDialogProps = {
  open: boolean;
  entityLabel: string;
  usage?: TaxonomyUsageSummary | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function usageWarning(summary: TaxonomyUsageSummary): string {
  const parts: string[] = [];
  if (summary.totalCount > 0) {
    parts.push(
      `Используется в ${summary.totalCount} материалах (статьи: ${summary.articleCount}, промпты: ${summary.promptCount}, видео: ${summary.videoCount}).`,
    );
  }
  if (summary.hasPublishedUsage) {
    parts.push("Есть опубликованные материалы с этой меткой.");
  }
  if (summary.hasDraftUsage) {
    parts.push("Есть черновики с этой меткой.");
  }
  return parts.join(" ");
}

export function ArchiveDialog({
  open,
  entityLabel,
  usage,
  loading = false,
  onConfirm,
  onCancel,
}: ArchiveDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  const usageText = usage && usage.totalCount > 0 ? usageWarning(usage) : null;

  return (
    <div className={styles.dialogOverlay} role="presentation" onClick={onCancel}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.dialogTitle}>
          Архивировать «{entityLabel}»?
        </h2>
        <p id={descId} className={styles.dialogBody}>
          Запись будет скрыта из выбора в новых материалах, но останется в
          уже связанных.
          {usageText ? ` ${usageText}` : null}
        </p>
        <div className={styles.dialogActions}>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Архивировать
          </Button>
        </div>
      </div>
    </div>
  );
}
