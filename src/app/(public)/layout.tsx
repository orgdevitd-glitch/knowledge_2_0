import type { Metadata } from "next";
import { connection } from "next/server";

import { getPublicEnv } from "@/config/public-env";
import { PublicShellChrome } from "@/features/public-content/ui/public-shell";
import { HeaderSearchForm } from "@/features/public-content/ui/header-search";
import { getPublicSearchUiLimits } from "@/server/composition/search-ui-limits";

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

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Request-time resolution so SEARCH_QUERY_MAX_LENGTH env overrides apply.
  await connection();
  const { queryMaxLength } = getPublicSearchUiLimits();

  return (
    <PublicShellChrome
      headerSearch={
        <HeaderSearchForm variant="header" queryMaxLength={queryMaxLength} />
      }
    >
      <main id="main-content">{children}</main>
    </PublicShellChrome>
  );
}
