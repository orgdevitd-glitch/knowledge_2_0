import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { getPromptsCatalogPage } from "@/features/public-content/queries";
import {
  CatalogFilters,
  CatalogResults,
} from "@/features/public-content/ui/catalog";

export const metadata: Metadata = {
  title: "Промты",
  description: "Библиотека опубликованных промтов портала знаний.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const model = await getPromptsCatalogPage({
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
            { id: "prompts", label: "Промты" },
          ]}
        />
        <header>
          <h1 style={{ margin: "0 0 0.5rem" }}>Библиотека промтов</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Готовые формулировки для рабочих задач. Полный текст открывается на
            странице промта.
          </p>
        </header>
        <CatalogFilters
          basePath="/prompts"
          model={model}
          showTypeFilter={false}
        />
        <CatalogResults
          model={model}
          emptyTitle="Промтов пока нет"
          emptyDescription="Опубликованные промты появятся в библиотеке."
        />
      </Stack>
    </Container>
  );
}
