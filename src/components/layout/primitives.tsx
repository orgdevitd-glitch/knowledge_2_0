import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

import styles from "./layout.module.css";

const gapMap = {
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  7: "var(--space-7)",
  8: "var(--space-8)",
} as const;

export type SpaceToken = keyof typeof gapMap;

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  width?: "standard" | "wide" | "editorial" | "full";
  children: ReactNode;
};

export function Container({
  width = "standard",
  className,
  children,
  ...rest
}: ContainerProps) {
  return (
    <div
      className={cn(
        styles.container,
        width === "standard" && styles.standard,
        width === "wide" && styles.wide,
        width === "editorial" && styles.editorial,
        width === "full" && styles.full,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: SpaceToken;
  children: ReactNode;
};

export function Stack({ gap = 4, className, style, children, ...rest }: StackProps) {
  return (
    <div
      className={cn(styles.stack, className)}
      style={{ gap: gapMap[gap], ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

type InlineProps = HTMLAttributes<HTMLDivElement> & {
  gap?: SpaceToken;
  wrap?: boolean;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  children: ReactNode;
};

export function Inline({
  gap = 2,
  wrap = false,
  align = "center",
  justify = "flex-start",
  className,
  style,
  children,
  ...rest
}: InlineProps) {
  return (
    <div
      className={cn(styles.inline, wrap && styles.wrap, className)}
      style={{
        gap: gapMap[gap],
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

type GridProps = HTMLAttributes<HTMLDivElement> & {
  gap?: SpaceToken;
  minItemWidth?: string;
  columns?: number;
  children: ReactNode;
};

export function Grid({
  gap = 3,
  minItemWidth = "16rem",
  columns,
  className,
  style,
  children,
  ...rest
}: GridProps) {
  return (
    <div
      className={cn(styles.grid, className)}
      style={{
        gap: gapMap[gap],
        gridTemplateColumns: columns
          ? `repeat(${columns}, minmax(0, 1fr))`
          : `repeat(auto-fill, minmax(min(100%, ${minItemWidth}), 1fr))`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "muted" | "dark" | "accent" | "information";
  children: ReactNode;
};

export function Surface({
  variant = "default",
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={cn(
        styles.surface,
        variant === "muted" && styles.surfaceMuted,
        variant === "dark" && styles.surfaceDark,
        variant === "accent" && styles.surfaceAccent,
        variant === "information" && styles.surfaceInfo,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type DividerProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function Divider({
  orientation = "horizontal",
  className,
}: DividerProps) {
  return (
    <hr
      className={cn(
        orientation === "horizontal" ? styles.dividerH : styles.dividerV,
        className,
      )}
      aria-orientation={orientation}
    />
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.visuallyHidden}>{children}</span>;
}


