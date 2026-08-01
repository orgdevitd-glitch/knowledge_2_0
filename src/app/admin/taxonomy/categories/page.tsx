import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, EmptyState, Link } from "@/components/ui";
import { CategoryTree } from "@/features/admin/taxonomy/components/category-tree";
import { listCategoryTree } from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Категории · Таксономия · Админ",
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

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPrincipal();
  const params = await searchParams;
  const query = first(params.q) ?? undefined;
  const status = parseStatus(first(params.status)) ?? "all";
  const persistence = isContentPersistenceAvailable();
  const tree = persistence
    ? await listCategoryTree({ query, status })
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
              { id: "categories", label: "Категории" },
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
            <h1 style={{ margin: "0 0 0.35rem" }}>Категории</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Иерархия разделов базы знаний.
            </p>
          </div>
          {persistence ? (
            <Link href="/admin/taxonomy/categories/new" variant="standalone">
              + Создать категорию
            </Link>
          ) : null}
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Список категорий недоступен.
          </Alert>
        ) : (
          <>
            <form
              method="get"
              action="/admin/taxonomy/categories"
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
              <button type="submit">Применить</button>
            </form>

            {tree.length === 0 ? (
              <EmptyState
                title="Категории не найдены"
                description="Создайте первую категорию или измените фильтры."
              />
            ) : (
              <CategoryTree nodes={tree} />
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
