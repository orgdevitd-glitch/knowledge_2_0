"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  AppHeader,
  MobileNavigationPanel,
  Sidebar,
  type SidebarGroup,
} from "@/components/layout";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import {
  ADMIN_NAV_ITEMS,
  isAdminSignInPath,
  resolveActiveAdminNavId,
} from "@/features/admin/nav";

import styles from "./admin-shell.module.css";

function buildGroups(activeId: string): SidebarGroup[] {
  return [
    {
      id: "main",
      label: "Разделы",
      items: ADMIN_NAV_ITEMS.map((item) => ({
        ...item,
        active: item.id === activeId,
      })),
    },
  ];
}

export function AdminShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [navOpen, setNavOpen] = useState(false);

  if (isAdminSignInPath(pathname)) {
    return (
      <div className={styles.signInShell}>
        <a href="#admin-main" className={styles.skipLink}>
          Перейти к содержимому
        </a>
        <main id="admin-main">{children}</main>
      </div>
    );
  }

  const activeId = resolveActiveAdminNavId(pathname);
  const groups = buildGroups(activeId);

  return (
    <div className={styles.shell}>
      <a href="#admin-main" className={styles.skipLink}>
        Перейти к содержимому
      </a>
      <AppHeader
        brand="Админ"
        brandHref="/admin"
        actions={
          <div className={styles.headerActions}>
            <AdminSignOutButton />
          </div>
        }
        onOpenNavigation={() => setNavOpen(true)}
      />
      <div className={styles.body}>
        <aside className={styles.sidebarDesktop} aria-label="Административная навигация">
          <Sidebar groups={groups} />
        </aside>
        <div className={styles.contentColumn}>
          <div className={styles.content}>
            <main id="admin-main">{children}</main>
          </div>
        </div>
      </div>
      <MobileNavigationPanel
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="Админ"
      >
        <div
          className={styles.mobileNav}
          onClick={(event) => {
            if ((event.target as HTMLElement | null)?.closest("a")) {
              setNavOpen(false);
            }
          }}
        >
          <Sidebar groups={groups} aria-label="Административная навигация" />
          <AdminSignOutButton />
        </div>
      </MobileNavigationPanel>
    </div>
  );
}
