"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Link, Textarea } from "@/components/ui";
import { Stack } from "@/components/layout";
import {
  AdminMutationClientError,
  adminTaxonomyApi,
} from "@/features/admin/taxonomy/client/admin-taxonomy-api";
import type { AdminAudienceDto } from "@/features/admin/taxonomy/types";

import { TaxonomyConflictAlert } from "./conflict-alert";
import { TaxonomySlugField } from "./taxonomy-slug-field";
import styles from "./taxonomy.module.css";

export type AudienceFormProps = {
  mode: "create" | "edit";
  audience?: AdminAudienceDto;
  cancelHref: string;
};

export function AudienceForm({ mode, audience, cancelHref }: AudienceFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(audience?.title ?? "");
  const [slug, setSlug] = useState(audience?.slug ?? "");
  const [description, setDescription] = useState(audience?.description ?? "");
  const [sortOrder, setSortOrder] = useState(
    audience?.sortOrder !== undefined ? String(audience.sortOrder) : "",
  );
  const [revision, setRevision] = useState(audience?.revision ?? 0);
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

    const sortOrderNum =
      sortOrder.trim() === "" ? undefined : Number.parseInt(sortOrder, 10);

    try {
      if (mode === "create") {
        const result = await adminTaxonomyApi.createAudience({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          sortOrder: sortOrderNum,
        });
        router.push(
          `/admin/taxonomy/audiences/${result.audience.id}/edit`,
        );
      } else if (audience) {
        const result = await adminTaxonomyApi.updateAudience(audience.id, {
          expectedRevision: revision,
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          sortOrder: sortOrderNum,
        });
        setRevision(result.audience.revision);
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
        setError("Не удалось сохранить аудиторию");
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
          disabled={loading || audience?.status === "archived"}
        />

        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          error={fieldErrors.description}
          disabled={loading || audience?.status === "archived"}
        />

        <Input
          label="Порядок сортировки"
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          description="Необязательно; меньшее значение — выше в списке"
          error={fieldErrors.sortOrder}
          disabled={loading || audience?.status === "archived"}
        />

        <div className={styles.formActions}>
          <Button
            type="submit"
            loading={loading}
            disabled={audience?.status === "archived"}
          >
            {mode === "create" ? "Создать аудиторию" : "Сохранить"}
          </Button>
          <Link href={cancelHref} variant="subtle">
            Отмена
          </Link>
        </div>
      </Stack>
    </form>
  );
}
