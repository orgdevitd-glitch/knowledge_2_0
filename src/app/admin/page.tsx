import type { Metadata } from "next";

import { Container, Stack, Breadcrumbs } from "@/components/layout";
import { Card, Link } from "@/components/ui";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { ADMIN_NAV_ITEMS } from "@/features/admin/nav";

export const metadata: Metadata = {
  title: "Администрирование",
  robots: { index: false, follow: false },
};

const SECTION_COPY: Record<string, string> = {
  articles: "Создание, редактирование и публикация статей.",
  prompts: "Библиотека промтов: черновики, публикация и версии.",
  media: "Загрузка изображений и документов для материалов.",
  taxonomy: "Категории, теги и аудитории.",
  import: "Ручной импорт из Google Drive, Docs и Sheets.",
  search: "Состояние поискового индекса и пересборка.",
};

export default async function AdminHomePage() {
  const principal = await requireAdminPrincipal();
  const sections = ADMIN_NAV_ITEMS.filter((item) => item.id !== "home");

  return (
    <Container width="wide">
      <Stack gap={5}>
        <Breadcrumbs items={[{ id: "admin", label: "Админ" }]} />
        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Администрирование</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {principal.displayName ?? principal.email}. Управление опубликованной
            базой знаний: материалы, медиатека, таксономия, импорт и поиск.
          </p>
        </header>

        <section aria-labelledby="admin-sections">
          <h2 id="admin-sections" style={{ margin: "0 0 0.75rem" }}>
            Разделы
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
            }}
          >
            {sections.map((item) => (
              <li key={item.id}>
                <Card>
                  <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>
                    <Link href={item.href} variant="standalone">
                      {item.label}
                    </Link>
                  </h3>
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                    {SECTION_COPY[item.id] ?? ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </Stack>
    </Container>
  );
}
