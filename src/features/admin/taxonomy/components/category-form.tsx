"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Link, NativeSelect, Textarea } from "@/components/ui";
import { Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminCategoryDto } from "@/features/admin/taxonomy/types";

import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomySlugField } from "./taxonomy-slug-field";
import styles from "./taxonomy.module.css";

export type ParentOption = {
  id: string;
  title: string;
  slug: string;
  depth: number;
};

export type CategoryFormProps = {
  mode: "create" | "edit";
  category?: AdminCategoryDto;
  parentOptions: ParentOption[];
  cancelHref: string;
};

export function CategoryForm({
  mode,
  category,
  parentOptions,
  cancelHref,
}: CategoryFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(category?.title ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [sortOrder, setSortOrder] = useState(
    category?.sortOrder !== undefined ? String(category.sortOrder) : "",
  );
  const [revision, setRevision] = useState(category?.revision ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);

  const parentSelectOptions = [
    { value: "", label: "— Корневая категория —" },
    ...parentOptions.map((opt) => ({
      value: opt.id,
      label: `${"—".repeat(opt.depth)} ${opt.title} (${opt.slug})`,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setConflict(false);

    const sortOrderNum =
      sortOrder.trim() === "" ? undefined : Number.parseInt(sortOrder, 10);

    try {
      if (mode === "create") {
        const result = await adminTaxonomyApi.createCategory({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          parentId: parentId || null,
          sortOrder: sortOrderNum,
        });
        router.push(
          `/admin/taxonomy/categories/${result.category.id}/edit`,
        );
      } else if (category) {
        const result = await adminTaxonomyApi.updateCategory(category.id, {
          expectedRevision: revision,
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          sortOrder: sortOrderNum,
        });
        setRevision(result.category.revision);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof AdminMutationClientError) {
        if (err.code === "CONFLICT") {
          setConflict(true);
        } else {
          setError(err.message);
          setFieldErrors(err.fields);
        }
      } else {
        setError("Не удалось сохранить категорию");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3}>
        {conflict ? (
          <TaxonomyConflictAlert onReload={() => router.refresh()} />
        ) : null}
        {error ? (
          <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>
            {error}
          </p>
        ) : null}

        <TaxonomySlugField
          title={title}
          slug={slug}
          onTitleChange={setTitle}
          onSlugChange={setSlug}
          titleError={fieldErrors.title}
          slugError={fieldErrors.slug}
          disabled={loading || category?.status === "archived"}
        />

        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          error={fieldErrors.description}
          disabled={loading || category?.status === "archived"}
        />

        {mode === "create" ? (
          <NativeSelect
            label="Родительская категория"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={parentSelectOptions}
            error={fieldErrors.parentId}
            disabled={loading}
          />
        ) : null}

        <Input
          label="Порядок сортировки"
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          description="Необязательно; меньшее значение — выше в списке"
          error={fieldErrors.sortOrder}
          disabled={loading || category?.status === "archived"}
        />

        <div className={styles.formActions}>
          <Button
            type="submit"
            loading={loading}
            disabled={category?.status === "archived"}
          >
            {mode === "create" ? "Создать категорию" : "Сохранить"}
          </Button>
          <Link href={cancelHref} variant="subtle">
            Отмена
          </Link>
        </div>
      </Stack>
    </form>
  );
}
