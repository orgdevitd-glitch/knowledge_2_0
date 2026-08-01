"use client";

import { useId } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/selection";

import styles from "./learning.module.css";

export function Progress({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
}) {
  const labelId = useId();
  const safeMax = max <= 0 ? 1 : max;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const ratio = clamped / safeMax;

  return (
    <div className={cn(styles.progress, className)}>
      <div className={styles.progressLabel} id={labelId}>
        {label}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-labelledby={labelId}
      >
        <div
          className={styles.fill}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}

export function LearningPathCard({
  title,
  description,
  stepsCount,
  durationLabel,
  progressValue,
  progressMax = 100,
  progressLabel,
  actionLabel = "Продолжить",
  onAction,
}: {
  title: string;
  description: string;
  stepsCount: number;
  durationLabel: string;
  progressValue: number;
  progressMax?: number;
  progressLabel: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <article className={styles.pathCard}>
      <h3 className={styles.pathTitle}>{title}</h3>
      <p className={styles.pathMeta}>{description}</p>
      <p className={styles.pathMeta}>
        {stepsCount} шагов · {durationLabel}
      </p>
      <Progress
        value={progressValue}
        max={progressMax}
        label={progressLabel}
      />
      <div>
        <Button type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}

export function ChecklistItem({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      label={label}
      description={description}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  );
}
