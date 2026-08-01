"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui";

export function CopyTextButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
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
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <Button type="button" size="small" variant="outline" onClick={onCopy} aria-label={label}>
        {copied ? "Скопировано" : label}
      </Button>
      {failed ? (
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
          Не удалось скопировать
        </span>
      ) : null}
    </div>
  );
}
