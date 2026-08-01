import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { AudienceForm } from "@/features/admin/taxonomy/components/audience-form";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Новая аудитория · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminNewAudiencePage() {
  await requireAdminPrincipal();
  const persistence = isContentPersistenceAvailable();

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
              { id: "new", label: "Новая аудитория" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Новая аудитория</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Создание целевой группы для материалов.
          </p>
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Создание аудиторий недоступно.
          </Alert>
        ) : (
          <AudienceForm mode="create" cancelHref="/admin/taxonomy/audiences" />
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy/audiences" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
