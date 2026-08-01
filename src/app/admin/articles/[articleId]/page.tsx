import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Badge, Link } from "@/components/ui";
import { ArticleActionsMenu } from "@/features/admin/articles/components/article-actions-menu";
import { getAdminArticleDetail } from "@/features/admin/articles/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Статья · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ articleId: string }>;

export default async function AdminArticleDetailPage({
  params,
}: {
  params: Params;
}) {
  const { articleId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminArticleDetail(principal, articleId);

  if (!detail) {
    notFound();
  }

  const { article, actions, recentAudit } = detail;

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
              { id: "current", label: article.title },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{article.title}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            <Badge>{article.status}</Badge>
            {" · "}
            rev {article.revision}
            {" · "}
            {article.blockCount} блоков
          </p>
        </header>

        <ArticleActionsMenu
          articleId={article.id}
          slug={article.slug}
          status={article.status}
          revision={article.revision}
          actions={actions}
        />

        <section aria-labelledby="meta-detail">
          <h2 id="meta-detail">Метаданные</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.35rem 1rem", margin: 0 }}>
            <dt>Slug</dt>
            <dd style={{ margin: 0 }}>
              <code>{article.slug}</code>
            </dd>
            <dt>Summary</dt>
            <dd style={{ margin: 0 }}>{article.summary ?? "—"}</dd>
            <dt>Создано</dt>
            <dd style={{ margin: 0 }}>{article.createdAt.slice(0, 19)}</dd>
            <dt>Обновлено</dt>
            <dd style={{ margin: 0 }}>{article.updatedAt.slice(0, 19)}</dd>
            <dt>Опубликовано</dt>
            <dd style={{ margin: 0 }}>{article.publishedAt?.slice(0, 19) ?? "—"}</dd>
            <dt>Пересмотр</dt>
            <dd style={{ margin: 0 }}>{article.reviewDueAt?.slice(0, 10) ?? "—"}</dd>
            <dt>Текущая версия</dt>
            <dd style={{ margin: 0 }}>
              <code>{article.currentVersion ?? "—"}</code>
            </dd>
            <dt>Опублик. версия</dt>
            <dd style={{ margin: 0 }}>
              <code>{article.publishedVersion ?? "—"}</code>
            </dd>
          </dl>
        </section>

        <section aria-labelledby="audit-heading">
          <h2 id="audit-heading">Последние события аудита</h2>
          {recentAudit.length === 0 ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Записей аудита пока нет.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr>
                    <th align="left">Время</th>
                    <th align="left">Событие</th>
                    <th align="left">Актор</th>
                    <th align="left">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudit.map((e) => (
                    <tr key={e.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td>{e.occurredAt.slice(0, 19)}</td>
                      <td>
                        <code>{e.eventType}</code>
                      </td>
                      <td>
                        <code>{e.actorId}</code>
                      </td>
                      <td>{e.changeSummary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p style={{ margin: 0 }}>
          <Link href="/admin/articles" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
