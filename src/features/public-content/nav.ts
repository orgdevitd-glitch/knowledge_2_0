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
  if (pathname === "/") return "home";
  if (pathname.startsWith("/assistant")) return "assistant";
  if (pathname.startsWith("/articles")) return "articles";
  if (pathname.startsWith("/prompts")) return "prompts";
  if (pathname.startsWith("/materials") || pathname.startsWith("/search")) {
    return "materials";
  }
  return "home";
}
