"use client";

import type { ReactNode, MouseEvent } from "react";

import { Link } from "@/components/ui";
import { markSearchFocusIntent } from "@/features/search/ui/search-focus-intent";

/** Next/Link wrapper that marks search focus intent before navigation. */
export function SearchFocusLink({
  href,
  children,
  variant = "standalone",
  className,
  "aria-label": ariaLabel,
}: {
  href: string;
  children: ReactNode;
  variant?: "inline" | "navigation" | "standalone" | "subtle";
  className?: string;
  "aria-label"?: string;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Title suggestion navigations must not set this; only search UX CTAs use this component.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    markSearchFocusIntent();
  };

  return (
    <Link
      href={href}
      variant={variant}
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
