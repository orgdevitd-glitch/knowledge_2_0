export type PublicNavItem = {
  id: string;
  label: string;
  href: string;
};

/** Application routes — not managed CMS content. Assistant is never always-on. */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { id: "home", label: "Главная", href: "/" },
  { id: "materials", label: "Все материалы", href: "/materials" },
  { id: "articles", label: "Статьи", href: "/articles" },
  { id: "prompts", label: "Промты", href: "/prompts" },
  { id: "search", label: "Поиск", href: "/search" },
];

export function buildPublicNavItems(input: {
  assistantAvailable: boolean;
}): PublicNavItem[] {
  const items = PUBLIC_NAV_ITEMS.map((item) => ({ ...item }));
  if (input.assistantAvailable) {
    items.push({
      id: "assistant",
      label: "Ассистент",
      href: "/assistant",
    });
  }
  return items;
}

export function resolveActiveNavId(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  if (path === "/") return "home";
  if (path.startsWith("/assistant")) return "assistant";
  if (path.startsWith("/articles")) return "articles";
  if (path.startsWith("/prompts")) return "prompts";
  if (path === "/search" || path.startsWith("/search/")) return "search";
  if (path.startsWith("/materials")) return "materials";
  return "home";
}
