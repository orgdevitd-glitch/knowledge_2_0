import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { EmptyState, Badge } from "@/components/ui";
import { Link } from "@/components/ui/Link";
import { searchPublicContent } from "@/features/public-content/queries";
import {
  highlightSegments,
  tokenize,
} from "@/features/public-content/search";
import { HeaderSearchForm } from "@/features/public-content/ui/header-search";
import { PUBLIC_CONTENT_LIMITS } from "@/features/public-content/limits";

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
  const result = await searchPublicContent({ q, type });
  const tokens = tokenize(result.normalizedQuery);

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

        <form method="get" action="/search" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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

        {result.tooLong ? (
          <EmptyState
            title="Запрос слишком длинный"
            description={`Сократите запрос до ${PUBLIC_CONTENT_LIMITS.searchMaxQueryLength} символов.`}
          />
        ) : null}

        {result.tooShort ? (
          <EmptyState
            title="Слишком короткий запрос"
            description={`Введите не меньше ${PUBLIC_CONTENT_LIMITS.searchMinQueryLength} символов.`}
          />
        ) : null}

        {!result.tooShort &&
        !result.tooLong &&
        result.normalizedQuery.length >=
          PUBLIC_CONTENT_LIMITS.searchMinQueryLength ? (
          <>
            <p aria-live="polite" style={{ margin: 0 }}>
              По запросу «{result.query}» найдено: {result.hits.length}
            </p>
            {result.hits.length === 0 ? (
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
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "1rem" }}>
                {result.hits.map((hit) => (
                  <li
                    key={hit.document.id}
                    style={{
                      padding: "1rem",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-control)",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <Badge>
                        {hit.document.type === "article" ? "Статья" : "Промт"}
                      </Badge>
                    </div>
                    <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>
                      <Link href={hit.document.url}>
                        {highlightSegments(hit.document.title, tokens).map(
                          (part, i) =>
                            part.match ? (
                              <mark
                                key={i}
                                style={{
                                  background: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                                  color: "inherit",
                                }}
                              >
                                {part.text}
                              </mark>
                            ) : (
                              <span key={i}>{part.text}</span>
                            ),
                        )}
                      </Link>
                    </h2>
                    {hit.document.summary ? (
                      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                        {hit.document.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {!q ? (
          <EmptyState
            title="Введите запрос"
            description="Найдите статью или промт по названию и тексту."
          />
        ) : null}
      </Stack>
    </Container>
  );
}
