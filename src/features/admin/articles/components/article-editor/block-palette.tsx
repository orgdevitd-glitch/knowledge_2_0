"use client";

import { useEffect, useRef } from "react";

import type { BlockType } from "@/domain/content/blocks";
import { Button } from "@/components/ui";
import { BLOCK_PALETTE_GROUPS } from "@/features/admin/articles/block-factory";

import styles from "./editor.module.css";

export type BlockPaletteProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (type: BlockType) => void;
};

export function BlockPalette({ open, onClose, onSelect }: BlockPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.paletteOverlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={styles.palettePanel}
        role="dialog"
        aria-modal="true"
        aria-label="Добавить блок"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.panelHeader}>
          <span>Добавить блок</span>
          <Button size="small" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        {BLOCK_PALETTE_GROUPS.map((group) => (
          <section key={group.id} className={styles.paletteGroup}>
            <h3 className={styles.paletteGroupTitle}>{group.title}</h3>
            <div className={styles.paletteGrid}>
              {group.items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className={styles.paletteItem}
                  onClick={() => {
                    onSelect(item.type);
                    onClose();
                  }}
                >
                  <span className={styles.paletteItemTitle}>{item.title}</span>
                  <span className={styles.paletteItemDesc}>{item.description}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
