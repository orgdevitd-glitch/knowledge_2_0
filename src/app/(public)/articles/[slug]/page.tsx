import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { getPublishedArticleBySlug } from "@/features/public-content/queries";
import { hydrateResolvedMedia } from "@/features/public-content/rendering/resolve-block-media";
import { ArticlePublicView } from "@/features/public-content/ui/article-public-view";
import { getSiteUrl } from "@/config/env";
import { getPublicMediaPresentationResolver } from "@/server/composition/public-media";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    return { title: "Материал не найден", robots: { index: false } };
  }
  const siteUrl = getSiteUrl();
  return {
    title: article.title,
    description: article.summary ?? undefined,
    alternates: siteUrl
      ? { canonical: `${siteUrl}/articles/${article.slug}` }
      : undefined,
    openGraph: {
      title: article.title,
      description: article.summary ?? undefined,
      type: "article",
    },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const resolvedMedia = await hydrateResolvedMedia(
    article.blocks,
    getPublicMediaPresentationResolver(),
  );

  return (
    <Container width="editorial">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "home", label: "Главная", href: "/" },
            { id: "articles", label: "Статьи", href: "/articles" },
            { id: "current", label: article.title },
          ]}
        />
        <ArticlePublicView article={article} resolvedMedia={resolvedMedia} />
      </Stack>
    </Container>
  );
}
