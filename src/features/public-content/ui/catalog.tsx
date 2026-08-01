import { Link } from "@/components/ui/Link";
import { Badge, EmptyState, Status } from "@/components/ui";
import { Stack } from "@/components/layout";
import type { CatalogPageModel, MaterialSummary } from "../read-models";
import {
  reviewStatusLabel,
  reviewStatusTone,
} from "../review-status";

import styles from "./catalog.module.css";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function MaterialCard({ item }: { item: MaterialSummary }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardMeta}>
        <Badge>
          {item.type === "article" ? "Статья" : "Промт"}
        </Badge>
        <Status
          tone={reviewStatusTone(item.reviewStatus)}
          label={reviewStatusLabel(item.reviewStatus)}
        />
      </div>
      <h2 className={styles.cardTitle}>
        <Link href={item.url}>{item.title}</Link>
      </h2>
      {item.summary ? <p className={styles.cardSummary}>{item.summary}</p> : null}
      <p className={styles.cardFooter}>
        {item.category ? <span>{item.category.title}</span> : null}
        <span>Обновлено {formatDate(item.updatedAt)}</span>
      </p>
    </article>
  );
}

export function CatalogFilters({
  basePath,
  model,
  showTypeFilter = true,
}: {
  basePath: string;
  model: CatalogPageModel;
  showTypeFilter?: boolean;
}) {
  const { filters } = model;

  function hrefFor(patch: Record<string, string | null>) {
    const params = new URLSearchParams();
    const next = {
      type: filters.type,
      category: filters.category,
      audience: filters.audience,
      sort: filters.sort,
      q: filters.q,
      ...patch,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value && key !== "page") params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <form className={styles.filters} method="get" action={basePath}>
      <label className={styles.filterField}>
        <span>Поиск</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Название или описание"
        />
      </label>
      {showTypeFilter ? (
        <label className={styles.filterField}>
          <span>Тип</span>
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">Все типы</option>
            {model.typeOptions.map((o) => (
              <option key={o.id} value={o.slug}>
                {o.title} ({o.count})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={styles.filterField}>
        <span>Категория</span>
        <select name="category" defaultValue={filters.category ?? ""}>
          <option value="">Все категории</option>
          {model.categoryOptions.map((o) => (
            <option key={o.id} value={o.slug}>
              {o.title} ({o.count})
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span>Аудитория</span>
        <select name="audience" defaultValue={filters.audience ?? ""}>
          <option value="">Все аудитории</option>
          {model.audienceOptions.map((o) => (
            <option key={o.id} value={o.slug}>
              {o.title} ({o.count})
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span>Сортировка</span>
        <select name="sort" defaultValue={filters.sort}>
          <option value="updated-desc">Сначала обновлённые</option>
          <option value="published-desc">Сначала опубликованные</option>
          <option value="title-asc">По названию</option>
        </select>
      </label>
      <div className={styles.filterActions}>
        <button type="submit" className={styles.applyBtn}>
          Применить
        </button>
        <Link href={basePath} variant="subtle">
          Сбросить
        </Link>
      </div>
      <p className={styles.srHint}>
        Активные быстрые ссылки:{" "}
        <Link href={hrefFor({ sort: "title-asc" })} variant="subtle">
          по названию
        </Link>
      </p>
    </form>
  );
}

export function CatalogResults({
  model,
  emptyTitle,
  emptyDescription,
}: {
  model: CatalogPageModel;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (model.total === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <Stack gap={4}>
      <p className={styles.count} aria-live="polite">
        Найдено: {model.total}
      </p>
      <div className={styles.list}>
        {model.items.map((item) => (
          <MaterialCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
      <CatalogPagination model={model} />
    </Stack>
  );
}

function CatalogPagination({
  model,
}: {
  model: CatalogPageModel;
}) {
  if (model.totalPages <= 1) return null;

  const params = new URLSearchParams();
  if (model.filters.type) params.set("type", model.filters.type);
  if (model.filters.category) params.set("category", model.filters.category);
  if (model.filters.audience) params.set("audience", model.filters.audience);
  if (model.filters.sort) params.set("sort", model.filters.sort);
  if (model.filters.q) params.set("q", model.filters.q);

  function pageHref(page: number) {
    const next = new URLSearchParams(params);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <nav className={styles.pagination} aria-label="Страницы результатов">
      {model.page > 1 ? (
        <Link href={pageHref(model.page - 1)} variant="standalone">
          Предыдущая страница
        </Link>
      ) : (
        <span aria-disabled="true">Предыдущая страница</span>
      )}
      <span aria-current="page">
        Страница {model.page} из {model.totalPages}
      </span>
      {model.page < model.totalPages ? (
        <Link href={pageHref(model.page + 1)} variant="standalone">
          Следующая страница
        </Link>
      ) : (
        <span aria-disabled="true">Следующая страница</span>
      )}
    </nav>
  );
}
