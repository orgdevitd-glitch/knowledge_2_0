import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { NewSourceForm } from "@/features/integrations/google/components/new-source-form";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";

export const metadata: Metadata = {
  title: "Новый источник Google · Админ",
  robots: { index: false, follow: false },
};

export default async function NewGoogleSourcePage() {
  await requireAdminPrincipal();
  if (!isGoogleWorkspaceEnabled()) {
    return (
      <Container width="wide">
        <Alert tone="warning" title="Интеграция отключена">
          Добавление источников недоступно.
        </Alert>
      </Container>
    );
  }

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
              { id: "integrations", label: "Интеграции", href: "/admin/integrations" },
              { id: "google", label: "Google", href: "/admin/integrations/google" },
              { id: "sources", label: "Источники", href: "/admin/integrations/google/sources" },
              { id: "new", label: "Новый" },
            ]}
          />
          <AdminSignOutButton />
        </div>
        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Новый источник</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Вставьте ссылку Google или выберите файл в разрешённой папке.
          </p>
        </header>
        <NewSourceForm />
      </Stack>
    </Container>
  );
}
