import { ArticleHeader } from "@/components/content";
import { ArticleBlocks } from "@/features/public-content/rendering/block-registry";
import type { MediaPresentation } from "@/features/public-content/rendering/media-resolver";
import {
  reviewStatusLabel,
  reviewStatusTone,
} from "@/features/public-content/review-status";
import type { ArticleDetail } from "@/features/public-content/read-models";
import { formatDate } from "@/features/public-content/ui/catalog";
import { ArticleTableOfContents } from "@/features/public-content/ui/article-toc";
import {
  relatedMaterialsList,
  taxonomyMetadataItems,
} from "@/features/public-content/ui/taxonomy-links";

import styles from "./article-public-view.module.css";

export function ArticlePublicView({
  article,
  resolvedMedia,
}: {
  article: ArticleDetail;
  resolvedMedia: Record<string, MediaPresentation>;
}) {
  const statusLabel = reviewStatusLabel(article.reviewStatus);
  const statusTone = reviewStatusTone(article.reviewStatus);
  const metadataItems = taxonomyMetadataItems({
    typeLabel: article.metadata.typeLabel,
    updatedLabel: formatDate(article.updatedAt),
    categories: article.metadata.categories,
    audiences: article.metadata.audiences,
    tags: article.metadata.tags,
  });

  return (
    <div
      className={
        article.tableOfContents.length > 0 ? styles.layoutWithToc : styles.layout
      }
    >
      <div className={styles.main}>
        <ArticleHeader
          title={article.title}
          summary={article.summary ?? undefined}
          metadata={metadataItems}
          statusLabel={statusLabel ?? undefined}
          statusTone={statusTone ?? undefined}
        />
        <ArticleBlocks
          blocks={article.blocks}
          ctx={{
            toc: article.tableOfContents,
            promptLookup: article.promptLookup,
            relatedMaterials: article.relatedMaterials,
            resolvedMedia,
          }}
        />
        {article.relatedMaterials.length > 0 ? (
          <aside className={styles.related} aria-label="Связанные материалы">
            <h2>Связанные материалы</h2>
            {relatedMaterialsList(article.relatedMaterials)}
          </aside>
        ) : null}
      </div>
      <ArticleTableOfContents items={article.tableOfContents} />
    </div>
  );
}
