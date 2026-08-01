"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Link } from "@/components/ui";
import { Inline } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminAudienceDto } from "@/features/admin/taxonomy/types";

import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomyStatusBadge } from "./taxonomy-status";
import styles from "./taxonomy.module.css";

export type AudienceListProps = {
  audiences: AdminAudienceDto[];
};

export function AudienceList({ audiences }: AudienceListProps) {
  const router = useRouter();
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onReorder = useCallback(
    async (id: string, revision: number, direction: "up" | "down") => {
      setReorderingId(id);
      setError(null);
      setConflict(false);
      try {
        await adminTaxonomyApi.reorderAudience(id, {
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

  if (audiences.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
        Аудитории не найдены.
      </p>
    );
  }

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
      <ul className={styles.denseList}>
        {audiences.map((audience) => {
          const busy = reorderingId === audience.id;
          return (
            <li key={audience.id} className={styles.denseRow}>
              <span className={styles.treeTitle}>{audience.title}</span>
              <code className={styles.treeSlug}>{audience.slug}</code>
              <TaxonomyStatusBadge status={audience.status} />
              <span className={styles.treeStats}>
                использований: {audience.usageCount ?? 0}
              </span>
              <Link
                href={`/admin/taxonomy/audiences/${audience.id}/edit`}
                variant="subtle"
              >
                Изменить
              </Link>
              <Inline gap={1}>
                <Button
                  size="small"
                  variant="outline"
                  disabled={busy || audience.status === "archived"}
                  loading={busy}
                  onClick={() =>
                    onReorder(audience.id, audience.revision, "up")
                  }
                  aria-label={`Выше: ${audience.title}`}
                >
                  ↑
                </Button>
                <Button
                  size="small"
                  variant="outline"
                  disabled={busy || audience.status === "archived"}
                  loading={busy}
                  onClick={() =>
                    onReorder(audience.id, audience.revision, "down")
                  }
                  aria-label={`Ниже: ${audience.title}`}
                >
                  ↓
                </Button>
              </Inline>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
