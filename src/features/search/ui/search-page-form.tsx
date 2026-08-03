"use client";

import { useState, type FormEvent } from "react";

import { Button, NativeSelect } from "@/components/ui";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import {
  buildSearchHref,
  type SearchUrlState,
} from "@/features/search/url/search-url-state";
import { SearchInputWithSuggestions } from "@/features/search/ui/search-input-with-suggestions";
import { markSearchFocusIntent } from "@/features/search/ui/search-focus-intent";

import styles from "./search.module.css";

export type TaxonomySelectOption = { id: string; title: string };

type Props = {
  urlState: SearchUrlState;
  maxLength: number;
  categories: TaxonomySelectOption[];
  tags: TaxonomySelectOption[];
  audiences: TaxonomySelectOption[];
  /** Display titles for selected IDs not in selectable lists (e.g. archived). */
  selectedLabels?: {
    category?: string | null;
    tag?: string | null;
    audience?: string | null;
  };
};

function withCurrentOption(
  blankLabel: string,
  options: TaxonomySelectOption[],
  selectedId: string | null | undefined,
  selectedLabel?: string | null,
): { value: string; label: string }[] {
  const base = [
    { value: "", label: blankLabel },
    ...options.map((o) => ({ value: o.id, label: o.title })),
  ];
  if (selectedId && !options.some((o) => o.id === selectedId)) {
    base.push({
      value: selectedId,
      label: selectedLabel?.trim()
        ? selectedLabel
        : `Недоступный фильтр (${selectedId})`,
    });
  }
  return base;
}

export function SearchPageForm({
  urlState,
  maxLength,
  categories,
  tags,
  audiences,
  selectedLabels,
}: Props) {
  const [pending, setPending] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: SearchUrlState = {
      q: String(data.get("q") ?? ""),
      type: (() => {
        const t = String(data.get("type") ?? "");
        return t === "article" || t === "prompt" ? t : null;
      })(),
      category: String(data.get("category") ?? "").trim() || null,
      tag: String(data.get("tag") ?? "").trim() || null,
      audience: String(data.get("audience") ?? "").trim() || null,
      cursor: null,
    };
    event.preventDefault();
    setPending(true);
    const details = form.querySelector<HTMLDetailsElement>("#search-filters-details");
    if (details) details.open = false;
    markSearchFocusIntent();
    window.location.assign(buildSearchHref(next, { hash: "search-results" }));
  };

  return (
    <form
      method="get"
      action="/search"
      role="search"
      aria-label="Поиск материалов"
      onSubmit={onSubmit}
      className={`${styles.layout} ${styles.layoutWithFilters}`}
      data-search-max-length={maxLength}
    >
      <aside className={styles.filtersAside}>
        <details id="search-filters-details" className={styles.filtersDetails}>
          <summary className={styles.filtersToggle}>Фильтры</summary>
          <div id="search-filters-panel" className={styles.filtersPanel}>
            <NativeSelect
              label="Тип"
              name="type"
              defaultValue={urlState.type ?? ""}
              options={[
                { value: "", label: "Все типы" },
                { value: "article", label: "Статьи" },
                { value: "prompt", label: "Промты" },
              ]}
            />
            <NativeSelect
              label="Категория"
              name="category"
              defaultValue={urlState.category ?? ""}
              options={withCurrentOption(
                "Все категории",
                categories,
                urlState.category,
                selectedLabels?.category,
              )}
            />
            <NativeSelect
              label="Тег"
              name="tag"
              defaultValue={urlState.tag ?? ""}
              options={withCurrentOption(
                "Все теги",
                tags,
                urlState.tag,
                selectedLabels?.tag,
              )}
            />
            <NativeSelect
              label="Аудитория"
              name="audience"
              defaultValue={urlState.audience ?? ""}
              options={withCurrentOption(
                "Все аудитории",
                audiences,
                urlState.audience,
                selectedLabels?.audience,
              )}
            />
          </div>
        </details>
      </aside>

      <div className={styles.formMain}>
        <div className={styles.queryRow}>
          <SearchInputWithSuggestions
            key={`page-q:${urlState.q}:${urlState.type}:${urlState.category}:${urlState.tag}:${urlState.audience}:${maxLength}`}
            variant="page"
            urlState={urlState}
            defaultQuery={urlState.q}
            maxLength={maxLength}
            idPrefix="page"
            label="Запрос"
            pending={pending}
            onPendingChange={setPending}
          />
          <Button type="submit" loading={pending}>
            {pending ? "Ищем…" : "Найти"}
          </Button>
        </div>
        {pending ? (
          <span className={styles.liveRegion} aria-live="polite">
            Выполняется поиск
          </span>
        ) : null}
        <p className={styles.countText}>
          Не больше {maxLength} символов. Минимум{" "}
          {SEARCH_LIMIT_DEFAULTS.queryMinLength} символа для поиска.
        </p>
      </div>
    </form>
  );
}
