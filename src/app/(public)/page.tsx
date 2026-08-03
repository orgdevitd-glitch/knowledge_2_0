import type { Metadata } from "next";

import { Container, Stack } from "@/components/layout";
import { EmptyState, Link } from "@/components/ui";
import { getHomePageModel } from "@/features/public-content/queries";
import { MaterialCard, formatDate } from "@/features/public-content/ui/catalog";
import { HeaderSearchForm } from "@/features/public-content/ui/header-search";
import { getPublicEnv } from "@/config/public-env";
import { getPublicSearchUiLimits } from "@/server/composition/search-ui-limits";

export const metadata: Metadata = {
  title: "Главная",
  description:
    "Портал знаний: поиск, каталог статей и библиотека промтов для сотрудников.",
};

export default async function HomePage() {
  const model = await getHomePageModel();
  const appName = getPublicEnv().NEXT_PUBLIC_APP_NAME;
  const { queryMaxLength } = getPublicSearchUiLimits();

  return (
    <Container width="wide">
      <Stack gap={7}>
        <section aria-labelledby="home-intro">
          <Stack gap={3}>
            <h1 id="home-intro" style={{ margin: 0 }}>
              {appName}
            </h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)", maxWidth: "40rem" }}>
              Открытый портал знаний: инструкции, статьи и промты. Регистрация не
              требуется. Доступны только опубликованные материалы.
            </p>
            <div style={{ maxWidth: "28rem" }}>
              <HeaderSearchForm variant="home" queryMaxLength={queryMaxLength} />
            </div>
            <p style={{ margin: 0 }}>
              <Link href="/materials" variant="standalone">
                Открыть каталог материалов
              </Link>
            </p>
          </Stack>
        </section>

        <section aria-labelledby="home-categories">
          <h2 id="home-categories">Разделы по категориям</h2>
          {model.categories.length === 0 ? (
            <EmptyState
              title="Категории пока не опубликованы"
              description="Когда появятся опубликованные материалы, разделы отобразятся здесь."
            />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
              {model.categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/materials?category=${c.slug}`}>
                    {c.title}
                  </Link>{" "}
                  <span style={{ color: "var(--color-text-muted)" }}>
                    ({c.count})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-recent">
          <h2 id="home-recent">Недавно обновлённые материалы</h2>
          {model.recentMaterials.length === 0 ? (
            <EmptyState
              title="Материалов пока нет"
              description="Опубликованные статьи и промты появятся в этом списке."
            />
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {model.recentMaterials.map((item) => (
                <MaterialCard key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="home-prompts">
          <h2 id="home-prompts">Библиотека промтов</h2>
          {model.recentPrompts.length === 0 ? (
            <EmptyState
              title="Промтов пока нет"
              description="Опубликованные промты появятся в библиотеке."
            />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
              {model.recentPrompts.map((p) => (
                <li key={p.id}>
                  <Link href={p.url}>{p.title}</Link>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {" "}
                    · обновлено {formatDate(p.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "1rem" }}>
            <Link href="/prompts" variant="standalone">
              Все промты
            </Link>
          </p>
        </section>

        <section aria-labelledby="home-audiences">
          <h2 id="home-audiences">Аудитории</h2>
          {model.audiences.length === 0 ? (
            <EmptyState
              title="Аудитории пока не заданы"
              description="Фильтры по аудиториям появятся вместе с опубликованными материалами."
            />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {model.audiences.map((a) => (
                <li key={a.id}>
                  <Link href={`/materials?audience=${a.slug}`} variant="standalone">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Stack>
    </Container>
  );
}
