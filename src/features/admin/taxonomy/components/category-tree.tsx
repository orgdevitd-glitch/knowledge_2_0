"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Link } from "@/components/ui";
import { Inline } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminCategoryTreeNode } from "@/features/admin/taxonomy/types";

import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomyStatusBadge } from "./taxonomy-status";
import styles from "./taxonomy.module.css";

function collectExpandableIds(nodes: AdminCategoryTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: AdminCategoryTreeNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.add(node.id);
        if (node.depth < 1) walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

type TreeNodeProps = {
  node: AdminCategoryTreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onReorder: (id: string, revision: number, direction: "up" | "down") => void;
  reorderingId: string | null;
};

function TreeNode({
  node,
  expanded,
  onToggle,
  onReorder,
  reorderingId,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const busy = reorderingId === node.id;

  return (
    <li className={styles.treeItem}>
      <div
        className={styles.treeRow}
        style={{ paddingInlineStart: `calc(${node.depth} * 1.25rem)` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.expandBtn}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Свернуть" : "Развернуть"}
            onClick={() => onToggle(node.id)}
          >
            {isExpanded ? "−" : "+"}
          </button>
        ) : (
          <span className={styles.expandPlaceholder} aria-hidden="true" />
        )}

        <div className={styles.treeMeta}>
          <span className={styles.treeTitle}>{node.title}</span>
          <code className={styles.treeSlug}>{node.slug}</code>
          <TaxonomyStatusBadge status={node.status} />
          <span className={styles.treeStats}>
            дочерних: {node.childCount} · использований: {node.usageCount ?? 0}
          </span>
        </div>

        <div className={styles.treeActions}>
          <Link href={`/admin/taxonomy/categories/${node.id}/edit`} variant="subtle">
            Изменить
          </Link>
          <Inline gap={1}>
            <Button
              size="small"
              variant="outline"
              disabled={busy || node.status === "archived"}
              loading={busy}
              onClick={() => onReorder(node.id, node.revision, "up")}
              aria-label={`Выше: ${node.title}`}
            >
              ↑
            </Button>
            <Button
              size="small"
              variant="outline"
              disabled={busy || node.status === "archived"}
              loading={busy}
              onClick={() => onReorder(node.id, node.revision, "down")}
              aria-label={`Ниже: ${node.title}`}
            >
              ↓
            </Button>
          </Inline>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <ul className={styles.tree}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onReorder={onReorder}
              reorderingId={reorderingId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export type CategoryTreeProps = {
  nodes: AdminCategoryTreeNode[];
};

export function CategoryTree({ nodes }: CategoryTreeProps) {
  const router = useRouter();
  const initialExpanded = useMemo(() => collectExpandableIds(nodes), [nodes]);
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onReorder = useCallback(
    async (id: string, revision: number, direction: "up" | "down") => {
      setReorderingId(id);
      setError(null);
      setConflict(false);
      try {
        await adminTaxonomyApi.reorderCategory(id, {
          expectedRevision: revision,
          direction,
        });
        router.refresh();
      } catch (err) {
        if (
          err instanceof AdminMutationClientError &&
          err.code === "CONFLICT"
        ) {
          setConflict(true);
        } else {
          setError(
            err instanceof AdminMutationClientError
              ? err.message
              : "Не удалось изменить порядок",
          );
        }
      } finally {
        setReorderingId(null);
      }
    },
    [router],
  );

  return (
    <div>
      {conflict ? (
        <div style={{ marginBottom: "0.75rem" }}>
          <TaxonomyConflictAlert onReload={() => router.refresh()} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: "var(--color-error)", margin: "0 0 0.75rem" }}>
          {error}
        </p>
      ) : null}
      <ul className={styles.tree}>
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            expanded={expanded}
            onToggle={onToggle}
            onReorder={onReorder}
            reorderingId={reorderingId}
          />
        ))}
      </ul>
    </div>
  );
}
