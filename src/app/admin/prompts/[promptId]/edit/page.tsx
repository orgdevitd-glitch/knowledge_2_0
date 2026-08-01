import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { PromptEditor } from "@/features/admin/prompts/components/prompt-editor";
import {
  getAdminPromptDetail,
  listAdminTaxonomyOptionsForPrompt,
} from "@/features/admin/prompts/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Редактор промта · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ promptId: string }>;

export default async function AdminPromptEditPage({
  params,
}: {
  params: Params;
}) {
  const { promptId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminPromptDetail(principal, promptId);

  if (!detail) {
    notFound();
  }

  const { prompt, actions } = detail;
  const taxonomy = await listAdminTaxonomyOptionsForPrompt({
    categoryIds: prompt.categoryIds,
    tagIds: prompt.tagIds,
    audienceIds: prompt.audienceIds,
  });

  if (!actions.canEdit) {
    return (
      <Container width="wide">
        <Stack gap={3}>
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "prompts", label: "Промты", href: "/admin/prompts" },
              { id: "current", label: prompt.title },
            ]}
          />
          <Alert tone="warning" title="Редактирование недоступно">
            Архивные промты нельзя редактировать.
          </Alert>
          <Link href={`/admin/prompts/${promptId}`} variant="standalone">
            К карточке промта
          </Link>
        </Stack>
      </Container>
    );
  }

  return (
    <Container width="wide">
      <Stack gap={3}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "prompts", label: "Промты", href: "/admin/prompts" },
              {
                id: "detail",
                label: prompt.title,
                href: `/admin/prompts/${promptId}`,
              },
              { id: "edit", label: "Редактор" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <PromptEditor
          initialPrompt={prompt}
          taxonomy={taxonomy}
          actions={actions}
        />
      </Stack>
    </Container>
  );
}
