import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { AudienceEditPanel } from "@/features/admin/taxonomy/components/audience-edit-panel";
import {
  getAudienceDetail,
  getTaxonomyUsageSummary,
} from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Редактирование аудитории · Админ",
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ audienceId: string }> };

export default async function AdminEditAudiencePage({ params }: Params) {
  await requireAdminPrincipal();
  const { audienceId } = await params;
  const persistence = isContentPersistenceAvailable();

  if (!persistence) {
    return (
      <Container width="wide">
        <Stack gap={4}>
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
              {
                id: "audiences",
                label: "Аудитории",
                href: "/admin/taxonomy/audiences",
              },
              { id: "edit", label: "Редактирование" },
            ]}
          />
          <h1 style={{ margin: 0 }}>Редактирование аудитории</h1>
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const [audience, usageSummary] = await Promise.all([
    getAudienceDetail(audienceId),
    getTaxonomyUsageSummary("audience", audienceId),
  ]);
  if (!audience || !usageSummary) notFound();

  return (
    <Container width="wide">
      <Stack gap={4}>
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
              { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
              {
                id: "audiences",
                label: "Аудитории",
                href: "/admin/taxonomy/audiences",
              },
              { id: "edit", label: audience.title },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{audience.title}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Редактирование аудитории · <code>{audience.slug}</code>
          </p>
        </header>

        <AudienceEditPanel audience={audience} usageSummary={usageSummary} />

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy/audiences" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
