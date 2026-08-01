import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, EmptyState, Link } from "@/components/ui";
import { ArticleActionsMenu } from "@/features/admin/articles/components/article-actions-menu";
import { actionsForStatus } from "@/features/admin/articles/queries";
import { listAdminArticles } from "@/features/admin/articles/list-admin-articles";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Статьи · Админ",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requireAdminPrincipal();
  const params = await searchParams;
  const page = await listAdminArticles(principal, {
    status: first(params.status),
    q: first(params.q),
    page: first(params.page),
  });

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
              { id: "articles", label: "Статьи" },
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
            <h1 style={{ margin: "0 0 0.35rem" }}>Статьи</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Управление материалами базы знаний.
            </p>
          </div>
          {page.persistenceMode !== "unavailable" ? (
            <Link href="/admin/articles/new" variant="standalone">
              + Создать статью
            </Link>
          ) : null}
        </header>

        {page.persistenceMode === "unavailable" ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Список статей недоступен до конфигурации
            persistence.
          </Alert>
        ) : null}

        <form
          method="get"
          action="/admin/articles"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
        >
          <label>
            Поиск{" "}
            <input
              name="q"
              defaultValue={first(params.q) ?? ""}
              type="search"
            />
          </label>
          <label>
            Статус{" "}
            <select name="status" defaultValue={first(params.status) ?? ""}>
              <option value="">Все</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="hidden">hidden</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <button type="submit">Применить</button>
        </form>

        {page.items.length === 0 ? (
          <EmptyState
            title="Статей нет"
            description="В текущем хранилище нет материалов или фильтры исключили все записи."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr>
                  <th align="left">Title</th>
                  <th align="left">Slug</th>
                  <th align="left">Status</th>
                  <th align="right">Rev</th>
                  <th align="right">Blocks</th>
                  <th align="left">Updated</th>
                  <th align="left">Review due</th>
                  <th align="left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <td>{item.title}</td>
                    <td>
                      <code>{item.slug}</code>
                    </td>
                    <td>
                      <Badge>{item.status}</Badge>
                    </td>
                    <td align="right">{item.revision}</td>
                    <td align="right">{item.blockCount}</td>
                    <td>{item.updatedAt.slice(0, 10)}</td>
                    <td>{item.reviewDueAt?.slice(0, 10) ?? "—"}</td>
                    <td>
                      <ArticleActionsMenu
                        articleId={item.id}
                        slug={item.slug}
                        status={item.status}
                        revision={item.revision}
                        actions={actionsForStatus(item.status)}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin" variant="subtle">
            Назад
          </Link>
          {" · "}
          Страница {page.page} / {page.totalPages} · всего {page.total}
        </p>
      </Stack>
    </Container>
  );
}
