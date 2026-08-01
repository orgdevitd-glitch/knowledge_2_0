import type { Metadata } from "next";

import { getPublicEnv } from "@/config/public-env";
import { PublicShellChrome } from "@/features/public-content/ui/public-shell";
import { HeaderSearchForm } from "@/features/public-content/ui/header-search";

export const metadata: Metadata = {
  title: {
    default: getPublicEnv().NEXT_PUBLIC_APP_NAME,
    template: `%s · ${getPublicEnv().NEXT_PUBLIC_APP_NAME}`,
  },
  description:
    "Корпоративный портал знаний: статьи, промты и поиск по опубликованным материалам.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PublicShellChrome headerSearch={<HeaderSearchForm />}>
      <main id="main-content">{children}</main>
    </PublicShellChrome>
  );
}
