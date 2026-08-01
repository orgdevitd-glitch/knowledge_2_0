export type PublicNavItem = {
  id: string;
  label: string;
  href: string;
};

/** Application routes — not managed CMS content. */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { id: "home", label: "Главная", href: "/" },
  { id: "materials", label: "Все материалы", href: "/materials" },
  { id: "articles", label: "Статьи", href: "/articles" },
  { id: "prompts", label: "Промты", href: "/prompts" },
];

export function resolveActiveNavId(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/articles")) return "articles";
  if (pathname.startsWith("/prompts")) return "prompts";
  if (pathname.startsWith("/materials") || pathname.startsWith("/search")) {
    return "materials";
  }
  return "home";
}
