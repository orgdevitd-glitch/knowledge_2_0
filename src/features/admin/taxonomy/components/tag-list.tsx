import { Link } from "@/components/ui";
import type { AdminTagDto } from "@/features/admin/taxonomy/types";

import { TaxonomyStatusBadge } from "./taxonomy-status";
import styles from "./taxonomy.module.css";

export type TagListProps = {
  tags: AdminTagDto[];
};

export function TagList({ tags }: TagListProps) {
  if (tags.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
        Теги не найдены.
      </p>
    );
  }

  return (
    <ul className={styles.denseList}>
      {tags.map((tag) => (
        <li key={tag.id} className={styles.denseRow}>
          <span className={styles.treeTitle}>{tag.title}</span>
          <code className={styles.treeSlug}>{tag.slug}</code>
          <TaxonomyStatusBadge status={tag.status} />
          <span className={styles.treeStats}>
            использований: {tag.usageCount ?? 0}
          </span>
          <Link href={`/admin/taxonomy/tags/${tag.id}/edit`} variant="subtle">
            Изменить
          </Link>
        </li>
      ))}
    </ul>
  );
}
