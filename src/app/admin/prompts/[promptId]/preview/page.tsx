import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { requireAdminPrompt } from "@/features/admin/prompts/queries";
import { buildPromptDetail } from "@/features/public-content/build-detail";
import { PromptPublicView } from "@/features/public-content/ui/prompt-public-view";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { getPublicClock, getPublicContentSource } from "@/server/composition/public-content";

export const metadata: Metadata = {
  title: "Предпросмотр промта · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ promptId: string }>;

export default async function AdminPromptPreviewPage({
  params,
}: {
  params: Params;
}) {
  const { promptId } = await params;
  const principal = await requireAdminPrincipal();
  let prompt;
  try {
    prompt = await requireAdminPrompt(principal, promptId);
  } catch {
    notFound();
  }

  const catalog = await getPublicContentSource().loadCatalog();
  const now = getPublicClock().now();
  const detail = buildPromptDetail(prompt, catalog, now);

  return (
    <Container width="editorial">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "admin", label: "Админ", href: "/admin" },
            { id: "prompts", label: "Промты", href: "/admin/prompts" },
            {
              id: "detail",
              label: prompt.title,
              href: `/admin/prompts/${promptId}`,
            },
            { id: "preview", label: "Предпросмотр" },
          ]}
        />

        <Alert tone="information" title="Предпросмотр черновика">
          Это текущее состояние промта в админке. Посетители публичного сайта
          видят только опубликованную версию.
        </Alert>

        <PromptPublicView prompt={detail} />

        <p style={{ margin: 0 }}>
          <Link href={`/admin/prompts/${promptId}/edit`} variant="standalone">
            Вернуться в редактор
          </Link>
          {" · "}
          <Link href={`/admin/prompts/${promptId}`} variant="subtle">
            Карточка промта
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
