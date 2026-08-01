"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Link, Textarea } from "@/components/ui";
import { Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminTagDto } from "@/features/admin/taxonomy/types";

import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomySlugField } from "./taxonomy-slug-field";
import styles from "./taxonomy.module.css";

export type TagFormProps = {
  mode: "create" | "edit";
  tag?: AdminTagDto;
  cancelHref: string;
};

export function TagForm({ mode, tag, cancelHref }: TagFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(tag?.title ?? "");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  const [description, setDescription] = useState(tag?.description ?? "");
  const [revision, setRevision] = useState(tag?.revision ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setConflict(false);

    try {
      if (mode === "create") {
        const result = await adminTaxonomyApi.createTag({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        });
        router.push(`/admin/taxonomy/tags/${result.tag.id}/edit`);
      } else if (tag) {
        const result = await adminTaxonomyApi.updateTag(tag.id, {
          expectedRevision: revision,
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        });
        setRevision(result.tag.revision);
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
        setError("Не удалось сохранить тег");
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
          disabled={loading || tag?.status === "archived"}
        />

        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          error={fieldErrors.description}
          disabled={loading || tag?.status === "archived"}
        />

        <div className={styles.formActions}>
          <Button
            type="submit"
            loading={loading}
            disabled={tag?.status === "archived"}
          >
            {mode === "create" ? "Создать тег" : "Сохранить"}
          </Button>
          <Link href={cancelHref} variant="subtle">
            Отмена
          </Link>
        </div>
      </Stack>
    </form>
  );
}
