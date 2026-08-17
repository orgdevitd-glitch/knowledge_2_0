import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { requireAdminArticle } from "@/features/admin/articles/queries";
import { buildArticleDetail } from "@/features/public-content/build-detail";
import { hydrateResolvedMedia } from "@/features/public-content/rendering/resolve-block-media";
import { ArticlePublicView } from "@/features/public-content/ui/article-public-view";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { getPublicClock, getPublicContentSource } from "@/server/composition/public-content";
import { getPublicMediaPresentationResolver } from "@/server/composition/public-media";

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

  const catalog = await getPublicContentSource().loadCatalog();
  const now = getPublicClock().now();
  const detail = buildArticleDetail(article, catalog, now);
  const resolvedMedia = await hydrateResolvedMedia(
    detail.blocks,
    getPublicMediaPresentationResolver(),
  );

  return (
    <Container width="editorial">
      <Stack gap={4}>
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

        <Alert tone="information" title="Предпросмотр черновика">
          Это текущее состояние статьи в админке. Посетители публичного сайта
          видят только опубликованную версию.
        </Alert>

        <ArticlePublicView article={detail} resolvedMedia={resolvedMedia} />

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
