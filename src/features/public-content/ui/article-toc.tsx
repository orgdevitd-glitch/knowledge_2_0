import type { TocItem } from "../read-models";

import styles from "./article-toc.module.css";

function TocList({ items }: { items: readonly TocItem[] }) {
  return (
    <ol className={styles.list}>
      {items.map((item) => (
        <li
          key={item.id}
          className={
            item.level === 3
              ? styles.level3
              : item.level === 4
                ? styles.level4
                : styles.level2
          }
        >
          <a href={`#${item.anchor}`}>{item.text}</a>
        </li>
      ))}
    </ol>
  );
}

export function ArticleTableOfContents({ items }: { items: readonly TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <>
      <details className={styles.mobile}>
        <summary>Содержание</summary>
        <nav aria-label="Содержание">
          <TocList items={items} />
        </nav>
      </details>
      <nav className={styles.desktop} aria-label="Содержание">
        <h2 className={styles.title}>Содержание</h2>
        <TocList items={items} />
      </nav>
    </>
  );
}
