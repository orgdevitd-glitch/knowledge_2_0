"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { Inline, Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminAudienceDto, TaxonomyUsageSummary } from "@/features/admin/taxonomy/types";

import { ArchiveDialog } from "./archive-dialog";
import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomyUsagePanel } from "./taxonomy-usage-panel";
import { AudienceForm } from "./audience-form";
import styles from "./taxonomy.module.css";

export type AudienceEditPanelProps = {
  audience: AdminAudienceDto & { usageCount: number };
  usageSummary: TaxonomyUsageSummary;
};

export function AudienceEditPanel({
  audience: initial,
  usageSummary,
}: AudienceEditPanelProps) {
  const router = useRouter();
  const [audience, setAudience] = useState(initial);
  const [reordering, setReordering] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReorder = async (direction: "up" | "down") => {
    setReordering(true);
    setError(null);
    setConflict(false);
    try {
      const result = await adminTaxonomyApi.reorderAudience(audience.id, {
        expectedRevision: audience.revision,
        direction,
      });
      setAudience((prev) => ({
        ...prev,
        sortOrder: result.audience.sortOrder,
        revision: result.audience.revision,
      }));
      router.refresh();
    } catch (err) {
      if (err instanceof AdminMutationClientError && err.code === "CONFLICT") {
        setConflict(true);
      } else {
        setError(
          err instanceof AdminMutationClientError
            ? err.message
            : "Не удалось изменить порядок",
        );
      }
    } finally {
      setReordering(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    setError(null);
    setConflict(false);
    try {
      const result = await adminTaxonomyApi.archiveAudience(
        audience.id,
        audience.revision,
      );
      setAudience((prev) => ({
        ...prev,
        status: result.audience.status,
        revision: result.audience.revision,
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
      const result = await adminTaxonomyApi.restoreAudience(
        audience.id,
        audience.revision,
      );
      setAudience((prev) => ({
        ...prev,
        status: result.audience.status,
        revision: result.audience.revision,
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

      <AudienceForm
        mode="edit"
        audience={audience}
        cancelHref="/admin/taxonomy/audiences"
      />

      <section className={styles.section} aria-labelledby="aud-order-heading">
        <h2 id="aud-order-heading" className={styles.sectionTitle}>
          Порядок в списке
        </h2>
        <Inline gap={2}>
          <Button
            variant="outline"
            onClick={() => handleReorder("up")}
            loading={reordering}
            disabled={audience.status === "archived"}
          >
            Выше
          </Button>
          <Button
            variant="outline"
            onClick={() => handleReorder("down")}
            loading={reordering}
            disabled={audience.status === "archived"}
          >
            Ниже
          </Button>
        </Inline>
      </section>

      <TaxonomyUsagePanel
        taxonomyType="audience"
        taxonomyId={audience.id}
        initialSummary={usageSummary}
      />

      <section className={styles.section} aria-labelledby="aud-archive-heading">
        <h2 id="aud-archive-heading" className={styles.sectionTitle}>
          Архив
        </h2>
        {audience.status === "archived" ? (
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
        entityLabel={audience.title}
        usage={usageSummary}
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
        loading={archiving}
      />
    </Stack>
  );
}
