"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";

export function PromptCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function onCopy() {
    setFailed(false);
    try {
      if (!navigator.clipboard?.writeText) {
        setFailed(true);
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <Button type="button" onClick={onCopy} aria-label="Копировать текст промта">
        {copied ? "Скопировано" : "Копировать"}
      </Button>
      {failed ? (
        <p role="status" style={{ marginTop: "0.5rem", color: "var(--color-text-muted)" }}>
          Не удалось скопировать. Выделите текст вручную.
        </p>
      ) : null}
      {copied ? (
        <span className="ds-sr-only" role="status">
          Текст скопирован
        </span>
      ) : null}
    </div>
  );
}
