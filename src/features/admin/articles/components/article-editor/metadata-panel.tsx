"use client";

import { useMemo, useState } from "react";

import { Checkbox, Input, SearchField, Textarea } from "@/components/ui";
import { Stack } from "@/components/layout";
import type { AdminTaxonomyOption } from "@/features/admin/articles/queries";

import styles from "./editor.module.css";

export type EditorMetadata = {
  title: string;
  slug: string;
  summary: string;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  reviewDueAt: string | null;
};

export type MetadataPanelProps = {
  metadata: EditorMetadata;
  taxonomy: {
    categories: AdminTaxonomyOption[];
    tags: AdminTaxonomyOption[];
    audiences: AdminTaxonomyOption[];
  };
  onChange: (metadata: EditorMetadata) => void;
};

function TaxonomyField({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: AdminTaxonomyOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <fieldset className={styles.formSection} style={{ border: "none", margin: 0, padding: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: "0.375rem", fontSize: "0.875rem" }}>
        {label}
      </legend>
      <SearchField
        label={`Поиск: ${label}`}
        hideLabel
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Поиск…"
      />
      <Stack gap={1} style={{ marginTop: "0.375rem", maxHeight: "8rem", overflowY: "auto" }}>
        {filtered.map((opt) => {
          const isArchived = opt.status === "archived";
          const isSelected = selected.includes(opt.id);
          // Archived values may remain linked and be removed, but not re-added.
          if (isArchived && !isSelected) return null;
          return (
            <Checkbox
              key={opt.id}
              label={
                isArchived ? `${opt.title} (архив)` : opt.title
              }
              checked={isSelected}
              onChange={() => toggle(opt.id)}
            />
          );
        })}
      </Stack>
    </fieldset>
  );
}

function reviewDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function reviewDateToIso(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  return `${dateStr}T12:00:00.000Z`;
}

export function MetadataPanel({ metadata, taxonomy, onChange }: MetadataPanelProps) {
  const patch = (partial: Partial<EditorMetadata>) => {
    onChange({ ...metadata, ...partial });
  };

  return (
    <div className={styles.formSection}>
      <Input
        label="Заголовок"
        value={metadata.title}
        onChange={(e) => patch({ title: e.target.value })}
      />
      <Input
        label="Slug"
        value={metadata.slug}
        onChange={(e) => patch({ slug: e.target.value })}
      />
      <Textarea
        label="Краткое описание"
        value={metadata.summary}
        onChange={(e) => patch({ summary: e.target.value })}
        rows={3}
      />
      <TaxonomyField
        label="Категории"
        options={taxonomy.categories}
        selected={metadata.categoryIds}
        onChange={(categoryIds) => patch({ categoryIds })}
      />
      <TaxonomyField
        label="Теги"
        options={taxonomy.tags}
        selected={metadata.tagIds}
        onChange={(tagIds) => patch({ tagIds })}
      />
      <TaxonomyField
        label="Аудитории"
        options={taxonomy.audiences}
        selected={metadata.audienceIds}
        onChange={(audienceIds) => patch({ audienceIds })}
      />
      <Input
        label="Дата пересмотра"
        type="date"
        value={reviewDateInputValue(metadata.reviewDueAt)}
        onChange={(e) => patch({ reviewDueAt: reviewDateToIso(e.target.value) })}
      />
    </div>
  );
}

export function metadataFromArticle(article: {
  title: string;
  slug: string;
  summary: string | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  reviewDueAt: string | null;
}): EditorMetadata {
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary ?? "",
    categoryIds: [...article.categoryIds],
    tagIds: [...article.tagIds],
    audienceIds: [...article.audienceIds],
    reviewDueAt: article.reviewDueAt,
  };
}

export function metadataEquals(a: EditorMetadata, b: EditorMetadata): boolean {
  return (
    a.title === b.title &&
    a.slug === b.slug &&
    a.summary === b.summary &&
    a.reviewDueAt === b.reviewDueAt &&
    a.categoryIds.join() === b.categoryIds.join() &&
    a.tagIds.join() === b.tagIds.join() &&
    a.audienceIds.join() === b.audienceIds.join()
  );
}
