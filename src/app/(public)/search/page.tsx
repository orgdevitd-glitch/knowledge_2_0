import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { EmptyState, Link } from "@/components/ui";
import { getSearchLimits } from "@/config/search-env";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { ValidationError, RepositoryError } from "@/domain/shared/errors";
import { executePublicSearch } from "@/features/search/application/search-query-service";
import {
  loadSearchTaxonomyMaps,
  resolveTaxonomyTitle,
} from "@/features/search/application/taxonomy-display";
import {
  buildSearchHref,
  clearSearchFilters,
  hasActiveSearchFilters,
  parseSearchUrlState,
  type SearchUrlState,
} from "@/features/search/url/search-url-state";
import {
  SearchFilterChips,
  type FilterChipModel,
} from "@/features/search/ui/search-filter-chips";
import { SearchPageForm } from "@/features/search/ui/search-page-form";
import { SearchResultCard } from "@/features/search/ui/search-result-card";
import { SearchResultsFocus } from "@/features/search/ui/search-results-focus";
import { SearchFocusLink } from "@/features/search/ui/search-focus-link";

import styles from "@/features/search/ui/search.module.css";

export const metadata: Metadata = {
  title: "Поиск",
  description: "Поиск по опубликованным материалам портала знаний.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CursorErrorKind = "invalid" | "expired";

function typeTitle(type: "article" | "prompt"): string {
  return type === "article" ? "Статьи" : "Промты";
}

function buildChips(
  state: SearchUrlState,
  maps: Awaited<ReturnType<typeof loadSearchTaxonomyMaps>>,
): FilterChipModel[] {
  const chips: FilterChipModel[] = [];
  if (state.type) {
    chips.push({
      key: "type",
      kindLabel: "Тип",
      title: typeTitle(state.type),
    });
  }
  if (state.category) {
    const resolved = resolveTaxonomyTitle(maps.display.categories, state.category);
    chips.push({
      key: "category",
      kindLabel: "Категория",
      title: resolved.known ? resolved.title : state.category,
      unavailable: !resolved.known,
    });
  }
  if (state.tag) {
    const resolved = resolveTaxonomyTitle(maps.display.tags, state.tag);
    chips.push({
      key: "tag",
      kindLabel: "Тег",
      title: resolved.known ? resolved.title : state.tag,
      unavailable: !resolved.known,
    });
  }
  if (state.audience) {
    const resolved = resolveTaxonomyTitle(maps.display.audiences, state.audience);
    chips.push({
      key: "audience",
      kindLabel: "Аудитория",
      title: resolved.known ? resolved.title : state.audience,
      unavailable: !resolved.known,
    });
  }
  return chips;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const state = parseSearchUrlState(params);
  const limits = getSearchLimits();
  const maps = await loadSearchTaxonomyMaps();
  const chips = buildChips(state, maps);
  const filtersActive = hasActiveSearchFilters(state);
  const categoryResolved = resolveTaxonomyTitle(
    maps.display.categories,
    state.category,
  );
  const tagResolved = resolveTaxonomyTitle(maps.display.tags, state.tag);
  const audienceResolved = resolveTaxonomyTitle(
    maps.display.audiences,
    state.audience,
  );

  let result: Awaited<ReturnType<typeof executePublicSearch>> | null = null;
  let unavailable = false;
  let cursorError: CursorErrorKind | null = null;

  try {
    result = await executePublicSearch({
      q: state.q,
      type: state.type,
      category: state.category,
      tag: state.tag,
      audience: state.audience,
      cursor: state.cursor,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      const code = String(error.details?.adminCode ?? "");
      if (code === "SEARCH_CURSOR_EXPIRED") {
        cursorError = "expired";
      } else if (code === "SEARCH_CURSOR_INVALID") {
        cursorError = "invalid";
      } else {
        unavailable = true;
      }
    } else if (error instanceof RepositoryError) {
      unavailable = true;
    } else {
      unavailable = true;
    }
  }

  const freshResultsHref = buildSearchHref(
    { ...state, cursor: null },
    { hash: "search-results" },
  );
  const retryHref = buildSearchHref(state, { hash: "search-results" });

  let liveMessage = "";
  if (unavailable) {
    liveMessage = "Поиск временно недоступен";
  } else if (cursorError) {
    liveMessage = "Ссылка на страницу результатов устарела";
  } else if (result?.tooShort) {
    liveMessage = "Запрос слишком короткий";
  } else if (result?.tooLong) {
    liveMessage = "Запрос слишком длинный";
  } else if (result && !result.emptyQuery && result.items.length === 0) {
    liveMessage = `Нет результатов по запросу «${state.q}»`;
  } else if (result && result.items.length > 0) {
    liveMessage = `Показано материалов на этой странице: ${result.items.length}`;
  }

  const showResultsRegion =
    Boolean(result) &&
    !unavailable &&
    !cursorError &&
    !result?.emptyQuery &&
    !result?.tooShort &&
    !result?.tooLong;

  return (
    <Container width="wide">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "home", label: "Главная", href: "/" },
            { id: "search", label: "Поиск" },
          ]}
        />
        <header>
          <h1 style={{ margin: "0 0 0.5rem" }}>Поиск</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Ищем только среди опубликованных статей и промтов.
          </p>
        </header>

        <SearchPageForm
          urlState={state}
          maxLength={limits.queryMaxLength}
          categories={maps.selectable.categories}
          tags={maps.selectable.tags}
          audiences={maps.selectable.audiences}
          selectedLabels={{
            category: categoryResolved.known ? categoryResolved.title : null,
            tag: tagResolved.known ? tagResolved.title : null,
            audience: audienceResolved.known ? audienceResolved.title : null,
          }}
        />

        <SearchFilterChips state={state} chips={chips} />

        <div className={styles.liveRegion} aria-live="polite">
          {liveMessage}
        </div>

        {unavailable ? (
          <EmptyState
            title="Поиск временно недоступен"
            description="Сохранены ваш запрос и фильтры. Попробуйте повторить поиск чуть позже."
            primaryAction={
              <SearchFocusLink href={retryHref}>
                Повторить поиск
              </SearchFocusLink>
            }
            secondaryAction={
              <Link href="/materials" variant="standalone">
                К каталогу
              </Link>
            }
          />
        ) : null}

        {cursorError ? (
          <EmptyState
            title={
              cursorError === "expired"
                ? "Результаты обновились"
                : "Ссылка на страницу устарела"
            }
            description="Откройте актуальные результаты с теми же запросом и фильтрами."
            primaryAction={
              <SearchFocusLink href={freshResultsHref}>
                Показать актуальные результаты
              </SearchFocusLink>
            }
          />
        ) : null}

        {!unavailable && !cursorError && result?.emptyQuery ? (
          <EmptyState
            title="Введите запрос"
            description="Найдите статью или промт по названию, термину или задаче. Доступны типы: статьи и промты."
            primaryAction={
              maps.guidedCategories.length > 0 ? (
                <ul className={styles.guidedList}>
                  {maps.guidedCategories.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={
                          c.slug
                            ? `/materials?category=${encodeURIComponent(c.slug)}`
                            : "/materials"
                        }
                        variant="standalone"
                      >
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        ) : null}

        {!unavailable && !cursorError && result?.tooShort ? (
          <EmptyState
            title="Слишком короткий запрос"
            description={`Введите не меньше ${SEARCH_LIMIT_DEFAULTS.queryMinLength} символов. Фильтры сохранены.`}
          />
        ) : null}

        {!unavailable && !cursorError && result?.tooLong ? (
          <EmptyState
            title="Запрос слишком длинный"
            description={`Сократите запрос до ${limits.queryMaxLength} символов. Фильтры сохранены.`}
          />
        ) : null}

        {showResultsRegion && result ? (
          <section
            id="search-results"
            className={styles.results}
            tabIndex={-1}
            aria-labelledby="search-results-heading"
          >
            <SearchResultsFocus />
            <h2 id="search-results-heading" className={styles.resultsHeading}>
              Результаты поиска
            </h2>
            <p className={styles.countText}>
              Показано материалов на этой странице: {result.items.length}
            </p>

            {result.items.length === 0 ? (
              <EmptyState
                title="Ничего не найдено"
                description={`По запросу «${state.q}» совпадений нет. Измените формулировку${
                  filtersActive ? " или уберите часть фильтров" : ""
                }.`}
                primaryAction={
                  filtersActive ? (
                    <SearchFocusLink
                      href={buildSearchHref(clearSearchFilters(state), {
                        hash: "search-results",
                      })}
                    >
                      Очистить фильтры
                    </SearchFocusLink>
                  ) : (
                    <Link href="/materials" variant="standalone">
                      К каталогу
                    </Link>
                  )
                }
              />
            ) : (
              <ul className={styles.resultList}>
                {result.items.map((item) => {
                  const categoryTitle = item.categoryIds[0]
                    ? resolveTaxonomyTitle(
                        maps.display.categories,
                        item.categoryIds[0],
                      ).title
                    : null;
                  const tagTitles = item.tagIds
                    .map((id) => resolveTaxonomyTitle(maps.display.tags, id))
                    .filter((r) => r.known)
                    .map((r) => r.title);
                  return (
                    <li key={`${item.entityType}:${item.entityId}`}>
                      <SearchResultCard
                        entityType={item.entityType}
                        title={item.title}
                        href={item.href}
                        snippet={item.snippet}
                        categoryTitle={categoryTitle || null}
                        tagTitles={tagTitles}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            <nav className={styles.pagination} aria-label="Страницы результатов">
              {result.nextCursor ? (
                <SearchFocusLink
                  href={buildSearchHref(
                    { ...state, cursor: result.nextCursor },
                    { hash: "search-results" },
                  )}
                >
                  Следующая страница
                </SearchFocusLink>
              ) : null}
              {state.cursor ? (
                <SearchFocusLink
                  href={buildSearchHref(
                    { ...state, cursor: null },
                    { hash: "search-results" },
                  )}
                >
                  К началу результатов
                </SearchFocusLink>
              ) : null}
            </nav>
          </section>
        ) : null}
      </Stack>
    </Container>
  );
}
