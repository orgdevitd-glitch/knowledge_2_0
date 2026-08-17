"use client";

import { Button } from "@/components/ui";

import { AdminDialog } from "./admin-dialog";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AdminDialog
      open={open}
      title={title}
      description={body}
      role="alertdialog"
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            onClick={() => {
              if (loading) return;
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
