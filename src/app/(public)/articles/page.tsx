import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { getArticlesCatalogPage } from "@/features/public-content/queries";
import {
  CatalogFilters,
  CatalogResults,
} from "@/features/public-content/ui/catalog";

export const metadata: Metadata = {
  title: "Статьи",
  description: "Каталог опубликованных статей портала знаний.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const model = await getArticlesCatalogPage({
    category: first(params.category),
    audience: first(params.audience),
    sort: first(params.sort),
    q: first(params.q),
    page: first(params.page),
  });

  return (
    <Container width="wide">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "home", label: "Главная", href: "/" },
            { id: "articles", label: "Статьи" },
          ]}
        />
        <header>
          <h1 style={{ margin: "0 0 0.5rem" }}>Статьи</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Инструкции и справочные материалы.
          </p>
        </header>
        <CatalogFilters
          basePath="/articles"
          model={model}
          showTypeFilter={false}
        />
        <CatalogResults
          model={model}
          emptyTitle="Статей пока нет"
          emptyDescription="Опубликованные статьи появятся в этом каталоге."
        />
      </Stack>
    </Container>
  );
}
