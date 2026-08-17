import { Link } from "@/components/ui/Link";
import { Badge, EmptyState, Status } from "@/components/ui";
import { Stack } from "@/components/layout";
import { catalogFilterHref, catalogFilterSearchParams, type CatalogPath } from "../catalog-url";
import type { CatalogPageModel, MaterialSummary } from "../read-models";
import {
  reviewStatusLabel,
  reviewStatusTone,
} from "../review-status";
import { CardTagList, TaxonomyRefList } from "./taxonomy-links";

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
  const statusLabel = reviewStatusLabel(item.reviewStatus);
  const statusTone = reviewStatusTone(item.reviewStatus);

  return (
    <article className={styles.card}>
      <div className={styles.cardMeta}>
        <Badge>
          {item.type === "article" ? "Статья" : "Промт"}
        </Badge>
        {statusLabel && statusTone ? (
          <Status tone={statusTone} label={statusLabel} />
        ) : null}
      </div>
      <h2 className={styles.cardTitle}>
        <Link href={item.url}>{item.title}</Link>
      </h2>
      {item.summary ? <p className={styles.cardSummary}>{item.summary}</p> : null}
      <div className={styles.cardFooter}>
        {item.category ? (
          <TaxonomyRefList refs={[item.category]} kind="category" />
        ) : null}
        {item.tags.length > 0 ? <CardTagList tags={item.tags} /> : null}
        <span>Обновлено {formatDate(item.updatedAt)}</span>
      </div>
    </article>
  );
}

export function CatalogFilters({
  basePath,
  model,
  showTypeFilter = true,
}: {
  basePath: CatalogPath;
  model: CatalogPageModel;
  showTypeFilter?: boolean;
}) {
  const { filters } = model;

  function hrefFor(patch: Partial<typeof filters>) {
    return catalogFilterHref(basePath, {
      type: showTypeFilter ? (patch.type !== undefined ? patch.type : filters.type) : null,
      category: patch.category !== undefined ? patch.category : filters.category,
      tag: patch.tag !== undefined ? patch.tag : filters.tag,
      audience: patch.audience !== undefined ? patch.audience : filters.audience,
      sort: patch.sort !== undefined ? patch.sort : filters.sort,
      q: patch.q !== undefined ? patch.q : filters.q,
    });
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
        <span>Тег</span>
        <select name="tag" defaultValue={filters.tag ?? ""}>
          <option value="">Все теги</option>
          {model.tagOptions.map((o) => (
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

  const params = catalogFilterSearchParams({
    type: model.filters.type,
    category: model.filters.category,
    tag: model.filters.tag,
    audience: model.filters.audience,
    sort: model.filters.sort,
    q: model.filters.q,
  });

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
