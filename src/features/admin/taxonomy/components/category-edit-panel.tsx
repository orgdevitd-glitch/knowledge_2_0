"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, NativeSelect } from "@/components/ui";
import { Inline, Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminCategoryDto, TaxonomyUsageSummary } from "@/features/admin/taxonomy/types";

import { ArchiveDialog } from "./archive-dialog";
import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomyUsagePanel } from "./taxonomy-usage-panel";
import type { ParentOption } from "./category-form";
import { CategoryForm } from "./category-form";
import styles from "./taxonomy.module.css";

export type CategoryEditPanelProps = {
  category: AdminCategoryDto & { usageCount: number };
  parentOptions: ParentOption[];
  usageSummary: TaxonomyUsageSummary;
};

export function CategoryEditPanel({
  category: initial,
  parentOptions,
  usageSummary,
}: CategoryEditPanelProps) {
  const router = useRouter();
  const [category, setCategory] = useState(initial);
  const [moveParentId, setMoveParentId] = useState(category.parentId ?? "");
  const [moving, setMoving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveOptions = [
    { value: "", label: "— Корневая категория —" },
    ...parentOptions.map((opt) => ({
      value: opt.id,
      label: `${"—".repeat(opt.depth)} ${opt.title} (${opt.slug})`,
    })),
  ];

  const handleMove = async () => {
    setMoving(true);
    setError(null);
    setConflict(false);
    try {
      const result = await adminTaxonomyApi.moveCategory(category.id, {
        expectedRevision: category.revision,
        parentId: moveParentId || null,
      });
      setCategory((prev) => ({ ...prev, ...result.category }));
      router.refresh();
    } catch (err) {
      if (err instanceof AdminMutationClientError && err.code === "CONFLICT") {
        setConflict(true);
      } else {
        setError(
          err instanceof AdminMutationClientError
            ? err.message
            : "Не удалось переместить категорию",
        );
      }
    } finally {
      setMoving(false);
    }
  };

  const handleReorder = async (direction: "up" | "down") => {
    setReordering(true);
    setError(null);
    setConflict(false);
    try {
      const result = await adminTaxonomyApi.reorderCategory(category.id, {
        expectedRevision: category.revision,
        direction,
      });
      setCategory((prev) => ({
        ...prev,
        sortOrder: result.category.sortOrder,
        revision: result.category.revision,
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
      const result = await adminTaxonomyApi.archiveCategory(
        category.id,
        category.revision,
      );
      setCategory((prev) => ({
        ...prev,
        status: result.category.status,
        revision: result.category.revision,
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
      const result = await adminTaxonomyApi.restoreCategory(
        category.id,
        category.revision,
      );
      setCategory((prev) => ({
        ...prev,
        status: result.category.status,
        revision: result.category.revision,
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

      <CategoryForm
        mode="edit"
        category={category}
        parentOptions={parentOptions}
        cancelHref="/admin/taxonomy/categories"
      />

      <section className={styles.section} aria-labelledby="move-heading">
        <h2 id="move-heading" className={styles.sectionTitle}>
          Перемещение
        </h2>
        <Stack gap={2}>
          <NativeSelect
            label="Новый родитель"
            value={moveParentId}
            onChange={(e) => setMoveParentId(e.target.value)}
            options={moveOptions}
            disabled={moving || category.status === "archived"}
          />
          <Button
            variant="secondary"
            onClick={handleMove}
            loading={moving}
            disabled={category.status === "archived"}
          >
            Переместить
          </Button>
        </Stack>
      </section>

      <section className={styles.section} aria-labelledby="order-heading">
        <h2 id="order-heading" className={styles.sectionTitle}>
          Порядок среди соседей
        </h2>
        <Inline gap={2}>
          <Button
            variant="outline"
            onClick={() => handleReorder("up")}
            loading={reordering}
            disabled={category.status === "archived"}
          >
            Выше
          </Button>
          <Button
            variant="outline"
            onClick={() => handleReorder("down")}
            loading={reordering}
            disabled={category.status === "archived"}
          >
            Ниже
          </Button>
        </Inline>
      </section>

      <TaxonomyUsagePanel
        taxonomyType="category"
        taxonomyId={category.id}
        initialSummary={usageSummary}
      />

      <section className={styles.section} aria-labelledby="archive-heading">
        <h2 id="archive-heading" className={styles.sectionTitle}>
          Архив
        </h2>
        {category.status === "archived" ? (
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
        entityLabel={category.title}
        usage={usageSummary}
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
        loading={archiving}
      />
    </Stack>
  );
}
