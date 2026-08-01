import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { ArticleEditor } from "@/features/admin/articles/components/article-editor/article-editor";
import {
  getAdminArticleDetail,
  listAdminTaxonomyOptions,
} from "@/features/admin/articles/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Редактор · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ articleId: string }>;

export default async function AdminArticleEditPage({
  params,
}: {
  params: Params;
}) {
  const { articleId } = await params;
  const principal = await requireAdminPrincipal();
  const [detail, taxonomy] = await Promise.all([
    getAdminArticleDetail(principal, articleId),
    listAdminTaxonomyOptions(),
  ]);

  if (!detail) {
    notFound();
  }

  const { article, actions } = detail;

  if (!actions.canEdit) {
    return (
      <Container width="wide">
        <Stack gap={3}>
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "articles", label: "Статьи", href: "/admin/articles" },
              { id: "current", label: article.title },
            ]}
          />
          <Alert tone="warning" title="Редактирование недоступно">
            Архивные статьи нельзя редактировать.
          </Alert>
          <Link href={`/admin/articles/${articleId}`} variant="standalone">
            К карточке статьи
          </Link>
        </Stack>
      </Container>
    );
  }

  return (
    <Container width="wide">
      <Stack gap={3}>
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
                label: article.title,
                href: `/admin/articles/${articleId}`,
              },
              { id: "edit", label: "Редактор" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <ArticleEditor
          initialArticle={article}
          taxonomy={taxonomy}
          actions={actions}
        />
      </Stack>
    </Container>
  );
}
