import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { EmptyState, Badge } from "@/components/ui";
import { Link } from "@/components/ui/Link";
import { executePublicSearch } from "@/features/search/application/search-query-service";
import { HeaderSearchForm } from "@/features/public-content/ui/header-search";
import { getSearchLimits } from "@/config/search-env";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";

export const metadata: Metadata = {
  title: "Поиск",
  description: "Поиск по опубликованным материалам портала знаний.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const type = first(params.type);
  const cursor = first(params.cursor);
  const limits = getSearchLimits();

  let result;
  let unavailable = false;
  try {
    result = await executePublicSearch({
      q,
      type,
      cursor,
    });
  } catch {
    unavailable = true;
    result = null;
  }

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
            Ищем только среди опубликованных материалов.
          </p>
        </header>

        <div style={{ maxWidth: "32rem" }}>
          <HeaderSearchForm defaultQuery={q} />
        </div>

        <form
          method="get"
          action="/search"
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
        >
          <input type="hidden" name="q" value={q} />
          <label>
            Тип{" "}
            <select name="type" defaultValue={type ?? ""}>
              <option value="">Все</option>
              <option value="article">Статьи</option>
              <option value="prompt">Промты</option>
            </select>
          </label>
          <button type="submit">Фильтровать</button>
        </form>

        {unavailable ? (
          <EmptyState
            title="Поиск временно недоступен"
            description="Попробуйте позже. Каталог материалов по-прежнему доступен."
            primaryAction={
              <Link href="/materials" variant="standalone">
                К каталогу
              </Link>
            }
          />
        ) : null}

        {result?.tooLong ? (
          <EmptyState
            title="Запрос слишком длинный"
            description={`Сократите запрос до ${limits.queryMaxLength} символов.`}
          />
        ) : null}

        {result?.tooShort ? (
          <EmptyState
            title="Слишком короткий запрос"
            description={`Введите не меньше ${SEARCH_LIMIT_DEFAULTS.queryMinLength} символов.`}
          />
        ) : null}

        {result &&
        !result.tooShort &&
        !result.tooLong &&
        !result.emptyQuery ? (
          <>
            <p aria-live="polite" style={{ margin: 0 }}>
              По запросу «{q}» найдено: {result.items.length}
              {result.incompleteScan ? " (неполный скан видимости)" : ""}
            </p>
            {result.items.length === 0 ? (
              <EmptyState
                title="Ничего не найдено"
                description="Попробуйте другие слова, проверьте орфографию или откройте каталог материалов."
                primaryAction={
                  <Link href="/materials" variant="standalone">
                    К каталогу
                  </Link>
                }
              />
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "1rem",
                }}
              >
                {result.items.map((item) => (
                  <li
                    key={`${item.entityType}:${item.entityId}`}
                    style={{
                      padding: "1rem",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-control)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <Badge>
                        {item.entityType === "article" ? "Статья" : "Промт"}
                      </Badge>
                    </div>
                    <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>
                      <Link href={item.href}>
                        {item.title}
                      </Link>
                    </h2>
                    {item.summary ? (
                      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                        {item.summary}
                      </p>
                    ) : (
                      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                        {item.snippet.map((part, i) =>
                          part.match ? (
                            <mark
                              key={i}
                              style={{
                                background:
                                  "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                                color: "inherit",
                              }}
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span key={i}>{part.text}</span>
                          ),
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {result.nextCursor ? (
              <p>
                <Link
                  href={`/search?q=${encodeURIComponent(q)}${
                    type ? `&type=${encodeURIComponent(type)}` : ""
                  }&cursor=${encodeURIComponent(result.nextCursor)}`}
                  variant="standalone"
                >
                  Следующая страница
                </Link>
              </p>
            ) : null}
          </>
        ) : null}

        {!q && !unavailable ? (
          <EmptyState
            title="Введите запрос"
            description="Найдите статью или промт по названию и тексту."
          />
        ) : null}
      </Stack>
    </Container>
  );
}
