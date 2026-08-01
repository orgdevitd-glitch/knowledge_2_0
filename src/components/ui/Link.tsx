import type { AnchorHTMLAttributes, ReactNode } from "react";
import NextLink from "next/link";

import { cn } from "@/lib/cn";

import styles from "./button.module.css";

export type LinkVariant = "inline" | "navigation" | "standalone" | "subtle";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: LinkVariant;
  active?: boolean;
  children: ReactNode;
};

export function Link({
  href,
  variant = "inline",
  active = false,
  className,
  children,
  ...rest
}: LinkProps) {
  const classes = cn(
    styles.link,
    variant === "inline" && styles.linkInline,
    variant === "navigation" && styles.linkNav,
    variant === "standalone" && styles.linkStandalone,
    variant === "subtle" && styles.linkSubtle,
    className,
  );

  const isInternal = href.startsWith("/") || href.startsWith("#");

  if (isInternal) {
    return (
      <NextLink
        href={href}
        className={classes}
        data-active={active ? "true" : undefined}
        {...rest}
      >
        {children}
      </NextLink>
    );
  }

  return (
    <a
      href={href}
      className={classes}
      data-active={active ? "true" : undefined}
      rel={rest.rel ?? "noopener noreferrer"}
      {...rest}
    >
      {children}
    </a>
  );
}
