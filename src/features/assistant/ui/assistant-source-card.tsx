import { Badge, Card, Link } from "@/components/ui";

import styles from "./assistant.module.css";

export type AssistantSourceCardModel = {
  number: number;
  title: string;
  href: string;
  entityType: "article" | "prompt";
  excerpt?: string;
};

export function AssistantSourceCard({
  source,
}: {
  source: AssistantSourceCardModel;
}) {
  const typeLabel = source.entityType === "article" ? "Статья" : "Промт";
  return (
    <Card
      as="article"
      id={`assistant-source-${source.number}`}
      tabIndex={-1}
      className={styles.sourceCard}
      aria-labelledby={`assistant-source-title-${source.number}`}
    >
      <div className={styles.sourceMeta}>
        <span aria-hidden="true">[{source.number}]</span>
        <Badge
          tone={source.entityType === "article" ? "information" : "accent"}
        >
          {typeLabel}
        </Badge>
      </div>
      <h3
        id={`assistant-source-title-${source.number}`}
        className={styles.sourceTitle}
      >
        {source.title}
      </h3>
      {source.excerpt ? (
        <p className={styles.sourceExcerpt}>{source.excerpt}</p>
      ) : null}
      <p style={{ margin: 0 }}>
        <Link href={source.href} variant="standalone">
          Открыть материал
        </Link>
      </p>
    </Card>
  );
}
