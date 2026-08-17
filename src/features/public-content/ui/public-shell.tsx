"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import {
  AppHeader,
  MobileNavigationPanel,
  Sidebar,
  type SidebarGroup,
} from "@/components/layout";
import { getPublicEnv } from "@/config/public-env";
import { buildPublicNavItems, resolveActiveNavId } from "../nav";

import styles from "./shell.module.css";

function buildGroups(activeId: string, assistantAvailable: boolean): SidebarGroup[] {
  return [
    {
      id: "main",
      label: "Разделы",
      items: buildPublicNavItems({ assistantAvailable }).map((item) => ({
        ...item,
        active: item.id === activeId,
      })),
    },
  ];
}

export function PublicShellChrome({
  children,
  headerSearch,
  assistantAvailable = false,
}: {
  children: React.ReactNode;
  headerSearch?: React.ReactNode;
  assistantAvailable?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const activeId = resolveActiveNavId(pathname);
  const groups = buildGroups(activeId, assistantAvailable);
  const [navOpen, setNavOpen] = useState(false);
  const { NEXT_PUBLIC_APP_NAME: appName } = getPublicEnv();

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Перейти к содержимому
      </a>
      <AppHeader
        brand={appName}
        brandHref="/"
        search={headerSearch}
        onOpenNavigation={() => setNavOpen(true)}
      />
      <div className={styles.body}>
        <aside className={styles.sidebarDesktop} aria-label="Основная навигация">
          <Sidebar groups={groups} />
        </aside>
        <div className={styles.contentColumn}>
          <div className={styles.content}>{children}</div>
          <footer className={styles.footer}>
            <p>
              {appName} · публичный портал знаний · только опубликованные
              материалы
            </p>
          </footer>
        </div>
      </div>
      <MobileNavigationPanel
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="Навигация"
      >
        <Sidebar groups={groups} />
      </MobileNavigationPanel>
    </div>
  );
}
