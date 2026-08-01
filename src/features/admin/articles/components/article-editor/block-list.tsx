"use client";

import { useCallback, useState } from "react";

import type { ContentBlock } from "@/domain/content/blocks";
import { IconButton } from "@/components/ui";
import { duplicateBlock } from "@/features/admin/articles/block-factory";

import { ConfirmDialog } from "../confirm-dialog";
import {
  BLOCK_TYPE_LABELS,
  blockHasContent,
  blockPreviewText,
} from "./block-utils";
import styles from "./editor.module.css";

export type BlockListProps = {
  blocks: ContentBlock[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onReorder: (blocks: ContentBlock[]) => void;
  onUpdate: (blocks: ContentBlock[]) => void;
};

export function BlockList({
  blocks,
  selectedBlockId,
  onSelect,
  onReorder,
  onUpdate,
}: BlockListProps) {
  const [deleteTarget, setDeleteTarget] = useState<ContentBlock | null>(null);

  const moveBlock = useCallback(
    (id: string, direction: "up" | "down" | "home" | "end") => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const next = [...blocks];
      let targetIdx = idx;
      if (direction === "up") targetIdx = Math.max(0, idx - 1);
      if (direction === "down") targetIdx = Math.min(blocks.length - 1, idx + 1);
      if (direction === "home") targetIdx = 0;
      if (direction === "end") targetIdx = blocks.length - 1;
      if (targetIdx === idx) return;
      const [item] = next.splice(idx, 1);
      if (!item) return;
      next.splice(targetIdx, 0, item);
      onReorder(next);
    },
    [blocks, onReorder],
  );

  const handleKeyDown = (e: React.KeyboardEvent, block: ContentBlock) => {
    if (e.key === "ArrowUp" && (e.altKey || e.ctrlKey)) {
      e.preventDefault();
      moveBlock(block.id, "up");
    } else if (e.key === "ArrowDown" && (e.altKey || e.ctrlKey)) {
      e.preventDefault();
      moveBlock(block.id, "down");
    } else if (e.key === "Home" && e.altKey) {
      e.preventDefault();
      moveBlock(block.id, "home");
    } else if (e.key === "End" && e.altKey) {
      e.preventDefault();
      moveBlock(block.id, "end");
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(block.id);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onUpdate(blocks.filter((b) => b.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (blocks.length === 0) {
    return (
      <div className={styles.emptyBlocks}>
        Блоков пока нет. Добавьте блок из палитры.
      </div>
    );
  }

  return (
    <>
      <ul className={styles.blockList} role="listbox" aria-label="Блоки статьи">
        {blocks.map((block, idx) => {
          const selected = block.id === selectedBlockId;
          return (
            <li key={block.id} className={styles.blockItem} role="option" aria-selected={selected}>
              <button
                type="button"
                className={`${styles.blockSelect} ${selected ? styles.blockSelectSelected : ""}`}
                onClick={() => onSelect(block.id)}
                onKeyDown={(e) => handleKeyDown(e, block)}
                tabIndex={selected ? 0 : -1}
              >
                <span className={styles.blockType}>
                  {idx + 1}. {BLOCK_TYPE_LABELS[block.type]}
                </span>
                <span className={styles.blockPreview}>{blockPreviewText(block)}</span>
              </button>
              <div className={styles.blockActions}>
                <IconButton
                  label="Выше"
                  size="small"
                  disabled={idx === 0}
                  onClick={() => moveBlock(block.id, "up")}
                >
                  ↑
                </IconButton>
                <IconButton
                  label="Ниже"
                  size="small"
                  disabled={idx === blocks.length - 1}
                  onClick={() => moveBlock(block.id, "down")}
                >
                  ↓
                </IconButton>
                <IconButton
                  label="Дублировать"
                  size="small"
                  onClick={() => {
                    const dup = duplicateBlock(block);
                    const next = [...blocks];
                    next.splice(idx + 1, 0, dup);
                    onUpdate(next);
                    onSelect(dup.id);
                  }}
                >
                  ⧉
                </IconButton>
                <IconButton
                  label="Удалить"
                  size="small"
                  variant="ghost"
                  onClick={() => {
                    if (blockHasContent(block)) {
                      setDeleteTarget(block);
                    } else {
                      onUpdate(blocks.filter((b) => b.id !== block.id));
                    }
                  }}
                >
                  ×
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        Alt+↑/↓ — перемещение, Alt+Home/End — в начало/конец
      </p>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Удалить блок?"
        body="Блок содержит данные. Это действие нельзя отменить до сохранения."
        confirmLabel="Удалить"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
