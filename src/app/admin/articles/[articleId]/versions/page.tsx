import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Badge, Link } from "@/components/ui";
import { ArticleActionsMenu } from "@/features/admin/articles/components/article-actions-menu";
import {
  getAdminArticleDetail,
  listAdminVersions,
} from "@/features/admin/articles/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Версии · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ articleId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function AdminArticleVersionsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { articleId } = await params;
  const sp = await searchParams;
  const pageNum = Number.parseInt(first(sp.page) ?? "1", 10);
  const principal = await requireAdminPrincipal();
  const [data, detail] = await Promise.all([
    listAdminVersions(
      principal,
      articleId,
      Number.isFinite(pageNum) ? pageNum : 1,
    ),
    getAdminArticleDetail(principal, articleId),
  ]);

  if (!data || !detail) {
    notFound();
  }

  const { article, actions } = detail;

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
              { id: "articles", label: "Статьи", href: "/admin/articles" },
              {
                id: "detail",
                label: data.articleTitle,
                href: `/admin/articles/${articleId}`,
              },
              { id: "versions", label: "Версии" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Версии: {data.articleTitle}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Опубликованная версия:{" "}
            <code>{data.publishedVersion ?? "—"}</code>
          </p>
        </header>

        <ArticleActionsMenu
          articleId={articleId}
          slug={article.slug}
          status={article.status}
          revision={article.revision}
          actions={actions}
        />

        {data.items.length === 0 ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Версий пока нет.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th align="left">№</th>
                  <th align="left">ID</th>
                  <th align="left">Создана</th>
                  <th align="left">Автор</th>
                  <th align="left">Описание</th>
                  <th align="left">Статус</th>
                  <th align="left" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td>{v.versionNumber}</td>
                    <td>
                      <code>{v.id}</code>
                    </td>
                    <td>{v.createdAt.slice(0, 19)}</td>
                    <td>
                      <code>{v.createdBy}</code>
                    </td>
                    <td>{v.changeSummary ?? "—"}</td>
                    <td>
                      {v.isPublishedVersion ? (
                        <Badge tone="success">Опубликована</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/articles/${articleId}/versions/${v.id}`}
                        variant="subtle"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ margin: 0 }}>
          Страница {data.page} / {data.totalPages} · всего {data.total}
          {" · "}
          <Link href="/admin/articles" variant="subtle">
            К списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
