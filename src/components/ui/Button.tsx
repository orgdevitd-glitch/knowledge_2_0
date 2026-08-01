import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

import styles from "./button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "small" | "medium" | "large";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
};

const sizeClass: Record<ButtonSize, string> = {
  small: styles.sm!,
  medium: styles.md!,
  large: styles.lg!,
};

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary!,
  secondary: styles.secondary!,
  outline: styles.outline!,
  ghost: styles.ghost!,
  danger: styles.danger!,
};

export function Button({
  variant = "primary",
  size = "medium",
  loading = false,
  disabled,
  iconStart,
  iconEnd,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={cn(
        styles.button,
        sizeClass[size],
        variantClass[variant],
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true">
          <span className={styles.spinnerDot} />
        </span>
      ) : null}
      <span className={loading ? styles.loadingLabel : undefined}>
        {iconStart}
        {children}
        {iconEnd}
      </span>
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "iconStart" | "iconEnd" | "children"> & {
  label: string;
  children: ReactNode;
};

export function IconButton({
  label,
  children,
  className,
  size = "medium",
  variant = "ghost",
  ...rest
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={label}
      size={size}
      variant={variant}
      className={cn(styles.iconButton, className)}
      {...rest}
    >
      {children}
    </Button>
  );
}
