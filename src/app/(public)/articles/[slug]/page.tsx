import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container } from "@/components/layout";
import { ArticleHeader } from "@/components/content";
import { getPublishedArticleBySlug } from "@/features/public-content/queries";
import { ArticleBlocks } from "@/features/public-content/rendering/block-registry";
import {
  reviewStatusLabel,
  reviewStatusTone,
} from "@/features/public-content/review-status";
import { formatDate } from "@/features/public-content/ui/catalog";
import { Link } from "@/components/ui/Link";
import { getSiteUrl } from "@/config/env";

import styles from "./article.module.css";

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

  const metadataItems = [
    { id: "type", label: "Тип", value: article.metadata.typeLabel },
    {
      id: "updated",
      label: "Обновлено",
      value: formatDate(article.updatedAt),
    },
    ...article.metadata.categories.map((c) => ({
      id: `cat-${c.id}`,
      label: "Категория",
      value: c.title,
    })),
    ...article.metadata.audiences.map((a) => ({
      id: `aud-${a.id}`,
      label: "Аудитория",
      value: a.title,
    })),
  ];

  return (
    <Container width="editorial">
      <div className={styles.layout}>
        <div className={styles.main}>
          <Breadcrumbs
            items={[
              { id: "home", label: "Главная", href: "/" },
              { id: "articles", label: "Статьи", href: "/articles" },
              { id: "current", label: article.title },
            ]}
          />
          <ArticleHeader
            title={article.title}
            summary={article.summary ?? undefined}
            metadata={metadataItems}
            statusLabel={reviewStatusLabel(article.reviewStatus)}
            statusTone={reviewStatusTone(article.reviewStatus)}
          />
          <ArticleBlocks
            blocks={article.blocks}
            ctx={{
              toc: article.tableOfContents,
              promptLookup: article.promptLookup,
              relatedMaterials: article.relatedMaterials,
            }}
          />
          {article.relatedMaterials.length > 0 ? (
            <aside className={styles.related} aria-label="Связанные материалы">
              <h2>Связанные материалы</h2>
              <ul>
                {article.relatedMaterials.map((item) => (
                  <li key={item.id}>
                    <Link href={item.url}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
        {article.tableOfContents.length > 0 ? (
          <nav className={styles.toc} aria-label="Оглавление">
            <h2 className={styles.tocTitle}>Содержание</h2>
            <ol>
              {article.tableOfContents.map((item) => (
                <li
                  key={item.id}
                  style={{
                    marginInlineStart: `${(item.level - 2) * 0.75}rem`,
                  }}
                >
                  <a href={`#${item.anchor}`}>{item.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
    </Container>
  );
}
