"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Inline, Stack } from "@/components/layout";
import { Badge, MetadataList, Status, type MetadataItem } from "@/components/ui";
import { Button } from "@/components/ui/Button";

import styles from "./content.module.css";

export function ArticleHeader({
  title,
  summary,
  metadata,
  statusLabel,
  statusTone = "success",
}: {
  title: string;
  summary?: string;
  metadata?: MetadataItem[];
  statusLabel?: string;
  statusTone?: "success" | "warning" | "error" | "info";
}) {
  return (
    <header className={styles.contentHeader}>
      <Inline gap={2} wrap>
        {statusLabel ? <Status tone={statusTone} label={statusLabel} /> : null}
      </Inline>
      <h1 className={styles.contentTitle}>{title}</h1>
      {summary ? <p className={styles.contentSummary}>{summary}</p> : null}
      {metadata ? <MetadataList items={metadata} /> : null}
    </header>
  );
}

export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("ds-prose", className)}>{children}</div>;
}

export type CalloutVariant = "information" | "tip" | "warning" | "important";

export function Callout({
  variant = "information",
  title,
  children,
}: {
  variant?: CalloutVariant;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        styles.callout,
        variant === "tip" && styles.calloutTip,
        variant === "warning" && styles.calloutWarning,
        variant === "important" && styles.calloutImportant,
      )}
      role="note"
    >
      <p className={styles.calloutTitle}>{title}</p>
      <div>{children}</div>
    </aside>
  );
}

export type StepItem = {
  id: string;
  title: string;
  description?: string;
  content?: ReactNode;
  completed?: boolean;
};

export function StepList({ steps }: { steps: StepItem[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(styles.step, step.completed && styles.stepDone)}
        >
          <div className={styles.stepIndex} aria-hidden="true">
            {step.completed ? "✓" : index + 1}
          </div>
          <div>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            {step.description ? (
              <p className={styles.stepBody}>{step.description}</p>
            ) : null}
            {step.content}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PromptBlock({
  title,
  description,
  promptText,
  copied = false,
  onCopy,
  relatedActions,
}: {
  title: string;
  description?: string;
  promptText: string;
  copied?: boolean;
  onCopy?: () => void;
  relatedActions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = promptText.length > 320;

  return (
    <section className={styles.prompt} aria-labelledby={`prompt-${title}`}>
      <Stack gap={2}>
        <h3 id={`prompt-${title}`} className={styles.stepTitle}>
          {title}
        </h3>
        {description ? <p className={styles.stepBody}>{description}</p> : null}
      </Stack>
      <pre
        className={cn(
          styles.promptCode,
          expanded && styles.promptCodeExpanded,
        )}
      >
        {promptText}
      </pre>
      <Inline gap={2} wrap>
        <Button type="button" onClick={onCopy}>
          {copied ? "Скопировано" : "Копировать"}
        </Button>
        {long ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Свернуть" : "Показать полностью"}
          </Button>
        ) : null}
        {relatedActions}
      </Inline>
    </section>
  );
}

export function TableOfContents({
  items,
  label = "Оглавление",
}: {
  items: Array<{ id: string; label: string; href: string }>;
  label?: string;
}) {
  return (
    <nav className={styles.toc} aria-label={label}>
      <Badge tone="neutral">{label}</Badge>
      <ol className={styles.tocList}>
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function RelatedContent({
  items,
  heading = "Связанные материалы",
}: {
  heading?: string;
  items: Array<{ id: string; title: string; href: string; type?: string }>;
}) {
  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.stepTitle}>
        {heading}
      </h2>
      <ul className={styles.related}>
        {items.map((item) => (
          <li key={item.id} className={styles.relatedItem}>
            <a href={item.href}>{item.title}</a>
            {item.type ? (
              <>
                {" "}
                <Badge tone="neutral">{item.type}</Badge>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
