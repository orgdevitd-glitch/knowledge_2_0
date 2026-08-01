"use client";

import { useCallback, useState } from "react";

import { Alert, Button, Link, Skeleton } from "@/components/ui";
import { Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
  type TaxonomyKind,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { TaxonomyUsageSummary } from "@/features/admin/taxonomy/types";

import styles from "./taxonomy.module.css";

const ENTITY_LABELS: Record<string, string> = {
  article: "Статья",
  prompt: "Промпт",
  video: "Видео",
};

function entityHref(ref: {
  entityType: string;
  entityId: string;
}): string | null {
  if (ref.entityType === "article") {
    return `/admin/articles/${ref.entityId}/edit`;
  }
  return null;
}

export type TaxonomyUsagePanelProps = {
  taxonomyType: TaxonomyKind;
  taxonomyId: string;
  initialSummary: TaxonomyUsageSummary;
};

export function TaxonomyUsagePanel({
  taxonomyType,
  taxonomyId,
  initialSummary,
}: TaxonomyUsagePanelProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [items, setItems] = useState(initialSummary.recentUsages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await adminTaxonomyApi.getUsage(taxonomyType, taxonomyId, {
        limit: 10,
      });
      setSummary(page.summary);
      setItems(page.items);
    } catch (err) {
      setError(
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось загрузить использование",
      );
    } finally {
      setLoading(false);
    }
  }, [taxonomyType, taxonomyId]);

  return (
    <section className={styles.section} aria-labelledby="usage-heading">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 id="usage-heading" className={styles.sectionTitle} style={{ margin: 0 }}>
          Использование
        </h2>
        <Button
          size="small"
          variant="outline"
          onClick={refresh}
          loading={loading}
        >
          Обновить
        </Button>
      </div>

      {error ? (
        <Alert tone="error" title="Ошибка загрузки">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Skeleton height="4rem" />
      ) : (
        <>
          <div className={styles.statsGrid} style={{ marginTop: "0.75rem" }}>
            <p className={styles.stat}>Всего: {summary.totalCount}</p>
            <p className={styles.stat}>Статьи: {summary.articleCount}</p>
            <p className={styles.stat}>Промпты: {summary.promptCount}</p>
            <p className={styles.stat}>Видео: {summary.videoCount}</p>
          </div>

          {summary.totalCount === 0 ? (
            <p style={{ margin: "0.5rem 0 0", color: "var(--color-text-muted)" }}>
              Не используется в материалах.
            </p>
          ) : (
            <Stack gap={1} style={{ marginTop: "0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
                Недавние связи
              </p>
              <ul className={styles.usageList}>
                {items.map((ref) => {
                  const href = entityHref(ref);
                  const typeLabel =
                    ENTITY_LABELS[ref.entityType] ?? ref.entityType;
                  return (
                    <li
                      key={`${ref.entityType}:${ref.entityId}`}
                      className={styles.usageItem}
                    >
                      {href ? (
                        <Link href={href} variant="subtle">
                          {ref.title}
                        </Link>
                      ) : (
                        <span>{ref.title}</span>
                      )}
                      {" · "}
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {typeLabel} · {ref.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Stack>
          )}
        </>
      )}
    </section>
  );
}
