export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
};

/** Application admin routes — not CMS content. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "home", label: "Главная", href: "/admin" },
  { id: "articles", label: "Статьи", href: "/admin/articles" },
  { id: "prompts", label: "Промты", href: "/admin/prompts" },
  { id: "media", label: "Медиа", href: "/admin/media" },
  { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
  { id: "import", label: "Импорт", href: "/admin/integrations" },
  { id: "search", label: "Поиск", href: "/admin/search" },
];

export function isAdminSignInPath(pathname: string): boolean {
  return pathname === "/admin/sign-in" || pathname.startsWith("/admin/sign-in/");
}

/**
 * Longest-prefix match except home, which is exact `/admin`.
 */
export function resolveActiveAdminNavId(pathname: string): string {
  if (pathname === "/admin" || pathname === "/admin/") return "home";
  if (pathname.startsWith("/admin/articles")) return "articles";
  if (pathname.startsWith("/admin/prompts")) return "prompts";
  if (pathname.startsWith("/admin/media")) return "media";
  if (pathname.startsWith("/admin/taxonomy")) return "taxonomy";
  if (pathname.startsWith("/admin/integrations")) return "import";
  if (pathname.startsWith("/admin/search")) return "search";
  return "home";
}
