import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { getCatalogPage } from "@/features/public-content/queries";
import {
  CatalogFilters,
  CatalogResults,
} from "@/features/public-content/ui/catalog";

export const metadata: Metadata = {
  title: "Все материалы",
  description: "Каталог опубликованных статей и промтов портала знаний.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const model = await getCatalogPage({
    type: first(params.type),
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
            { id: "materials", label: "Все материалы" },
          ]}
        />
        <header>
          <h1 style={{ margin: "0 0 0.5rem" }}>Все материалы</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Опубликованные статьи и промты. Фильтры сохраняются в адресе
            страницы.
          </p>
        </header>
        <CatalogFilters basePath="/materials" model={model} />
        <CatalogResults
          model={model}
          emptyTitle="Ничего не найдено"
          emptyDescription="Измените фильтры или сбросьте их, чтобы увидеть доступные материалы."
        />
      </Stack>
    </Container>
  );
}
