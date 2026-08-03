import { Badge, Link } from "@/components/ui";
import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { isSafePublicSearchHref } from "@/domain/search/search-href";

import styles from "./search.module.css";

export type SearchResultCardProps = {
  entityType: "article" | "prompt";
  title: string;
  href: string;
  snippet: { text: string; match: boolean }[];
  categoryTitle?: string | null;
  tagTitles?: string[];
};

export function SearchResultCard({
  entityType,
  title,
  href,
  snippet,
  categoryTitle,
  tagTitles = [],
}: SearchResultCardProps) {
  const typeLabel = entityType === "article" ? "Статья" : "Промт";
  const visibleTags = tagTitles.slice(
    0,
    SEARCH_LIMIT_DEFAULTS.suggestionsMaxTagsOnCard,
  );
  const extraTags = Math.max(0, tagTitles.length - visibleTags.length);
  const hasMatch = snippet.some((s) => s.match);
  const safeHref = isSafePublicSearchHref(href) ? href : null;

  // Fail-closed: never render an unsafe href.
  if (!safeHref) return null;

  return (
    <article className={styles.resultCard}>
      <div className={styles.resultMeta}>
        <Badge tone={entityType === "article" ? "information" : "accent"}>
          {typeLabel}
        </Badge>
        <span className={styles.srOnly}>Тип материала: {typeLabel}</span>
      </div>
      <h3 className={styles.resultTitle}>
        <Link href={safeHref}>{title}</Link>
      </h3>
      {snippet.length > 0 && (hasMatch || snippet.some((s) => s.text.trim())) ? (
        <p className={styles.resultSnippet}>
          {snippet.map((part, index) =>
            part.match ? (
              <mark key={index} className={styles.resultMark}>
                {part.text}
              </mark>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>
      ) : null}
      {categoryTitle || visibleTags.length > 0 ? (
        <p className={styles.resultTaxonomy}>
          {categoryTitle ? <span>Категория: {categoryTitle}</span> : null}
          {visibleTags.map((tag) => (
            <span key={tag}>Тег: {tag}</span>
          ))}
          {extraTags > 0 ? <span>+{extraTags}</span> : null}
        </p>
      ) : null}
    </article>
  );
}
