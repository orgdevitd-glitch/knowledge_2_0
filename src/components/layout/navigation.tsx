"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";

import styles from "./nav.module.css";

export function AppHeader({
  brand,
  brandHref = "/",
  search,
  actions,
  onOpenNavigation,
}: {
  brand: ReactNode;
  brandHref?: string;
  search?: ReactNode;
  actions?: ReactNode;
  onOpenNavigation?: () => void;
}) {
  return (
    <header className={styles.header}>
      {onOpenNavigation ? (
        <IconButton label="Открыть навигацию" onClick={onOpenNavigation}>
          ☰
        </IconButton>
      ) : null}
      <a className={styles.brand} href={brandHref}>
        {brand}
      </a>
      {search ? <div className={styles.headerSearch}>{search}</div> : null}
      {actions}
    </header>
  );
}

export type SidebarItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

export type SidebarGroup = {
  id: string;
  label: string;
  items: SidebarItem[];
};

export function Sidebar({
  groups,
  collapsed = false,
  "aria-label": ariaLabel = "Боковая навигация",
}: {
  groups: SidebarGroup[];
  collapsed?: boolean;
  "aria-label"?: string;
}) {
  return (
    <nav
      className={cn(styles.sidebar, collapsed && styles.sidebarCollapsed)}
      aria-label={ariaLabel}
    >
      {groups.map((group) => (
        <div key={group.id} className={styles.sidebarGroup}>
          {!collapsed ? (
            <div className={styles.sidebarGroupLabel}>{group.label}</div>
          ) : null}
          {group.items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={cn(
                styles.sidebarLink,
                item.active && styles.sidebarLinkActive,
              )}
              aria-current={item.active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              {collapsed ? item.label.slice(0, 1) : item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

export type BreadcrumbItem = {
  id: string;
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
  label = "Хлебные крошки",
}: {
  items: BreadcrumbItem[];
  label?: string;
}) {
  return (
    <nav className={styles.breadcrumbs} aria-label={label}>
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.id}>
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} variant="subtle">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function MobileNavigationPanel({
  open,
  onClose,
  title = "Навигация",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.mobilePanel} role="presentation">
      <button
        type="button"
        className={styles.mobileBackdrop}
        aria-label="Закрыть навигацию"
        onClick={onClose}
      />
      <div
        className={styles.mobileSheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            gap: "0.75rem",
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: "1rem" }}>
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            style={{
              minWidth: "2.75rem",
              minHeight: "2.75rem",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-control)",
              background: "var(--color-background)",
              cursor: "pointer",
              fontSize: "1.25rem",
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
