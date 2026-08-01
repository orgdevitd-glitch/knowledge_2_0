import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Inline } from "@/components/layout";
import { Button } from "@/components/ui/Button";

import styles from "./display.module.css";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "information"
  | "success"
  | "warning"
  | "error";

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        styles.badge,
        tone === "neutral" && styles.neutral,
        tone === "accent" && styles.accent,
        tone === "information" && styles.information,
        tone === "success" && styles.success,
        tone === "warning" && styles.warning,
        tone === "error" && styles.error,
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusColor: Record<"success" | "warning" | "error" | "info", string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
};

export function Status({
  tone,
  label,
  className,
}: {
  tone: "success" | "warning" | "error" | "info";
  label: string;
  className?: string;
}) {
  return (
    <span className={cn(styles.status, className)}>
      <span
        className={styles.marker}
        style={{ background: statusColor[tone] }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

export type AlertTone = "information" | "success" | "warning" | "error";

export function Alert({
  tone = "information",
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        styles.alert,
        tone === "information" && styles.alertInfo,
        tone === "success" && styles.alertSuccess,
        tone === "warning" && styles.alertWarning,
        tone === "error" && styles.alertError,
        className,
      )}
    >
      <p className={styles.alertTitle}>{title}</p>
      {children ? <div className={styles.alertBody}>{children}</div> : null}
      <Inline gap={2}>
        {action}
        {onDismiss ? (
          <Button type="button" variant="ghost" size="small" onClick={onDismiss}>
            Закрыть
          </Button>
        ) : null}
      </Inline>
    </div>
  );
}

export type CardProps = HTMLAttributes<HTMLElement> & {
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  as?: "article" | "div" | "section";
  children: ReactNode;
};

export function Card({
  interactive = false,
  selected = false,
  disabled = false,
  as: Tag = "article",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        styles.card,
        interactive && styles.cardInteractive,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        className,
      )}
      data-selected={selected ? "true" : undefined}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type MetadataItem = {
  label: string;
  value: ReactNode;
};

export function MetadataList({
  items,
  className,
}: {
  items: MetadataItem[];
  className?: string;
}) {
  return (
    <ul className={cn(styles.meta, className)}>
      {items.map((item) => (
        <li key={item.label} className={styles.metaItem}>
          <span className={styles.metaTerm}>{item.label}:</span>
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(styles.empty, className)}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      {description ? <p className={styles.emptyBody}>{description}</p> : null}
      <Inline gap={2} justify="center">
        {primaryAction}
        {secondaryAction}
      </Inline>
    </div>
  );
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  className,
  "aria-label": ariaLabel = "Загрузка",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ width, height }}
      role="status"
      aria-label={ariaLabel}
    />
  );
}
