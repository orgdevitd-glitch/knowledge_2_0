import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import type { ContentBlock } from "@/domain/content/blocks";
import { requireAdminArticle } from "@/features/admin/articles/queries";
import { ArticleBlocks } from "@/features/public-content/rendering/block-registry";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Предпросмотр · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ articleId: string }>;

export default async function AdminArticlePreviewPage({
  params,
}: {
  params: Params;
}) {
  const { articleId } = await params;
  const principal = await requireAdminPrincipal();
  let article;
  try {
    article = await requireAdminArticle(principal, articleId);
  } catch {
    notFound();
  }

  const blocks = article.blocks as ContentBlock[];

  return (
    <Container width="editorial">
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
                label: article.title,
                href: `/admin/articles/${articleId}`,
              },
              { id: "preview", label: "Предпросмотр" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <Alert tone="information" title="Режим предпросмотра">
          Это черновик или текущее состояние статьи. На публичном сайте может
          отображаться другая опубликованная версия.
        </Alert>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{article.title}</h1>
          {article.summary ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              {article.summary}
            </p>
          ) : null}
        </header>

        <ArticleBlocks
          blocks={blocks}
          ctx={{
            toc: [],
            promptLookup: {},
            relatedMaterials: [],
          }}
        />

        <p style={{ margin: 0 }}>
          <Link href={`/admin/articles/${articleId}/edit`} variant="standalone">
            Вернуться в редактор
          </Link>
          {" · "}
          <Link href={`/admin/articles/${articleId}`} variant="subtle">
            Карточка статьи
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
