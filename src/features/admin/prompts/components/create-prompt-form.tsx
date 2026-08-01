"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Checkbox, Input, SearchField, Textarea } from "@/components/ui";
import { Stack } from "@/components/layout";
import type { AdminTaxonomyOption } from "@/features/admin/prompts/queries";
import { slugifyTitle } from "@/features/admin/articles/slug";
import {
  AdminMutationClientError,
  adminPromptsApi,
} from "@/features/admin/prompts/client/admin-prompts-api";

export type CreatePromptFormProps = {
  taxonomy: {
    categories: AdminTaxonomyOption[];
    tags: AdminTaxonomyOption[];
    audiences: AdminTaxonomyOption[];
  };
};

function toIsoDate(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  return `${dateStr}T12:00:00.000Z`;
}

function TaxonomyCheckboxes({
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
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{label}</legend>
      <SearchField
        label={`Поиск: ${label}`}
        hideLabel
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Поиск…"
      />
      <Stack gap={1} style={{ marginTop: "0.5rem", maxHeight: "12rem", overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            Ничего не найдено
          </p>
        ) : (
          filtered.map((opt) => (
            <Checkbox
              key={opt.id}
              label={opt.title}
              description={opt.slug}
              checked={selected.includes(opt.id)}
              onChange={() => toggle(opt.id)}
            />
          ))
        )}
      </Stack>
    </fieldset>
  );
}

export function CreatePromptForm({ taxonomy }: CreatePromptFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [summary, setSummary] = useState("");
  const [promptText, setPromptText] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManual) {
      setSlug(slugifyTitle(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await adminPromptsApi.create({
        title: title.trim(),
        slug: slug.trim(),
        summary: summary.trim() || null,
        promptText: promptText.trim(),
        categoryIds,
        tagIds,
        audienceIds,
        reviewDueAt: toIsoDate(reviewDueAt),
      });
      router.push(`/admin/prompts/${result.prompt.id}/edit`);
    } catch (err) {
      if (err instanceof AdminMutationClientError) {
        setError(err.message);
        setFieldErrors(err.fields);
      } else {
        setError("Не удалось создать промт");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3}>
        {error ? (
          <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>
            {error}
          </p>
        ) : null}

        <Input
          label="Заголовок"
          required
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          error={fieldErrors.title}
        />

        <Input
          label="Slug (URL)"
          required
          value={slug}
          onChange={(e) => {
            setSlugManual(true);
            setSlug(e.target.value);
          }}
          description="Латиница, цифры и дефисы"
          error={fieldErrors.slug}
        />

        <Textarea
          label="Краткое описание"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          error={fieldErrors.summary}
        />

        <Textarea
          label="Текст промта"
          required
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={12}
          description="Основной текст промта для копирования"
          error={fieldErrors.promptText}
        />

        <TaxonomyCheckboxes
          label="Категории"
          options={taxonomy.categories}
          selected={categoryIds}
          onChange={setCategoryIds}
        />

        <TaxonomyCheckboxes
          label="Теги"
          options={taxonomy.tags}
          selected={tagIds}
          onChange={setTagIds}
        />

        <TaxonomyCheckboxes
          label="Аудитории"
          options={taxonomy.audiences}
          selected={audienceIds}
          onChange={setAudienceIds}
        />

        <Input
          label="Дата пересмотра"
          type="date"
          value={reviewDueAt}
          onChange={(e) => setReviewDueAt(e.target.value)}
          error={fieldErrors.reviewDueAt}
        />

        <div>
          <Button type="submit" loading={loading}>
            Создать черновик
          </Button>
        </div>
      </Stack>
    </form>
  );
}
