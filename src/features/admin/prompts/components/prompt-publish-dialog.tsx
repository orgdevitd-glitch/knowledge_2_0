"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";

export type PromptPublishDialogProps = {
  open: boolean;
  loading?: boolean;
  onConfirm: (changeSummary: string) => void;
  onCancel: () => void;
};

export function PromptPublishDialog({
  open,
  loading = false,
  onConfirm,
  onCancel,
}: PromptPublishDialogProps) {
  const [changeSummary, setChangeSummary] = useState("");

  const handleConfirm = () => {
    onConfirm(changeSummary.trim());
  };

  const handleCancel = () => {
    setChangeSummary("");
    onCancel();
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgb(1 1 1 / 45%)",
      }}
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-prompt-dialog-title"
        style={{
          width: "min(100%, 32rem)",
          padding: "1.25rem",
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md, 0.5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="publish-prompt-dialog-title" style={{ margin: "0 0 0.75rem" }}>
          Опубликовать промт
        </h2>
        <Input
          label="Описание изменений"
          description="Необязательно. Будет сохранено в истории версий."
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          maxLength={500}
        />
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Отмена
          </Button>
          <Button loading={loading} onClick={handleConfirm}>
            Опубликовать
          </Button>
        </div>
      </div>
    </div>
  );
}
