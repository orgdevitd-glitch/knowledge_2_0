import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, EmptyState, Link } from "@/components/ui";
import { TagList } from "@/features/admin/taxonomy/components/tag-list";
import { listTagsAdmin } from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Теги · Таксономия · Админ",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function parseStatus(
  raw: string | null,
): "active" | "archived" | "all" | undefined {
  if (raw === "active" || raw === "archived" || raw === "all") return raw;
  return undefined;
}

function parseSort(
  raw: string | null,
): "title_asc" | "updated_desc" | "usage_desc" | undefined {
  if (raw === "title_asc" || raw === "updated_desc" || raw === "usage_desc") {
    return raw;
  }
  return undefined;
}

export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPrincipal();
  const params = await searchParams;
  const query = first(params.q) ?? undefined;
  const status = parseStatus(first(params.status)) ?? "all";
  const sort = parseSort(first(params.sort)) ?? "title_asc";
  const persistence = isContentPersistenceAvailable();
  const tags = persistence
    ? await listTagsAdmin({ query, status, sort })
    : [];

  return (
    <Container width="wide">
      <Stack gap={4}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
              { id: "tags", label: "Теги" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 0.35rem" }}>Теги</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Метки для перекрёстной классификации материалов.
            </p>
          </div>
          {persistence ? (
            <Link href="/admin/taxonomy/tags/new" variant="standalone">
              + Создать тег
            </Link>
          ) : null}
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Список тегов недоступен.
          </Alert>
        ) : (
          <>
            <form
              method="get"
              action="/admin/taxonomy/tags"
              style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
            >
              <label>
                Поиск{" "}
                <input
                  name="q"
                  defaultValue={query ?? ""}
                  type="search"
                />
              </label>
              <label>
                Статус{" "}
                <select name="status" defaultValue={status}>
                  <option value="all">Все</option>
                  <option value="active">Активные</option>
                  <option value="archived">В архиве</option>
                </select>
              </label>
              <label>
                Сортировка{" "}
                <select name="sort" defaultValue={sort}>
                  <option value="title_asc">По названию</option>
                  <option value="updated_desc">По дате изменения</option>
                  <option value="usage_desc">По использованию</option>
                </select>
              </label>
              <button type="submit">Применить</button>
            </form>

            {tags.length === 0 ? (
              <EmptyState
                title="Теги не найдены"
                description="Создайте первый тег или измените фильтры."
              />
            ) : (
              <TagList tags={tags} />
            )}
          </>
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy" variant="subtle">
            Назад к таксономии
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
