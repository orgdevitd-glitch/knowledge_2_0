"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminTagDto, TaxonomyUsageSummary } from "@/features/admin/taxonomy/types";

import { ArchiveDialog } from "./archive-dialog";
import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomyUsagePanel } from "./taxonomy-usage-panel";
import { TagForm } from "./tag-form";
import styles from "./taxonomy.module.css";

export type TagEditPanelProps = {
  tag: AdminTagDto & { usageCount: number };
  usageSummary: TaxonomyUsageSummary;
};

export function TagEditPanel({ tag: initial, usageSummary }: TagEditPanelProps) {
  const router = useRouter();
  const [tag, setTag] = useState(initial);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setArchiving(true);
    setError(null);
    setConflict(false);
    try {
      const result = await adminTaxonomyApi.archiveTag(tag.id, tag.revision);
      setTag((prev) => ({
        ...prev,
        status: result.tag.status,
        revision: result.tag.revision,
      }));
      setArchiveOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof AdminMutationClientError && err.code === "CONFLICT") {
        setConflict(true);
        setArchiveOpen(false);
      } else {
        setError(
          err instanceof AdminMutationClientError
            ? err.message
            : "Не удалось архивировать",
        );
      }
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    setConflict(false);
    try {
      const result = await adminTaxonomyApi.restoreTag(tag.id, tag.revision);
      setTag((prev) => ({
        ...prev,
        status: result.tag.status,
        revision: result.tag.revision,
      }));
      router.refresh();
    } catch (err) {
      if (err instanceof AdminMutationClientError && err.code === "CONFLICT") {
        setConflict(true);
      } else {
        setError(
          err instanceof AdminMutationClientError
            ? err.message
            : "Не удалось восстановить",
        );
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Stack gap={4}>
      {conflict ? (
        <TaxonomyConflictAlert onReload={() => router.refresh()} />
      ) : null}
      {error ? (
        <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>
          {error}
        </p>
      ) : null}

      <TagForm mode="edit" tag={tag} cancelHref="/admin/taxonomy/tags" />

      <TaxonomyUsagePanel
        taxonomyType="tag"
        taxonomyId={tag.id}
        initialSummary={usageSummary}
      />

      <section className={styles.section} aria-labelledby="tag-archive-heading">
        <h2 id="tag-archive-heading" className={styles.sectionTitle}>
          Архив
        </h2>
        {tag.status === "archived" ? (
          <Button variant="secondary" onClick={handleRestore} loading={restoring}>
            Восстановить из архива
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setArchiveOpen(true)}>
            Архивировать
          </Button>
        )}
      </section>

      <ArchiveDialog
        open={archiveOpen}
        entityLabel={tag.title}
        usage={usageSummary}
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
        loading={archiving}
      />
    </Stack>
  );
}
