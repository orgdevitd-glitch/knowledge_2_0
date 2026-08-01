import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { getGoogleWorkspaceMode } from "@/config/env";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";

export const metadata: Metadata = {
  title: "Интеграции · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminIntegrationsPage() {
  await requireAdminPrincipal();
  const mode = getGoogleWorkspaceMode();
  const enabled = isGoogleWorkspaceEnabled();

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
              { id: "integrations", label: "Интеграции" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Интеграции</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Внешние источники подготовки контента. Публикация остаётся в портале.
          </p>
        </header>

        <section
          aria-labelledby="gw-heading"
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "1.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h2 id="gw-heading" style={{ margin: "0 0 0.35rem" }}>
                Google Workspace
              </h2>
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                Ручной импорт Google Docs и Sheets в черновики.
              </p>
            </div>
            <Badge tone={enabled ? "success" : "warning"}>
              {enabled ? "service-account" : mode}
            </Badge>
          </div>

          {!enabled ? (
            <Alert tone="information" title="Интеграция недоступна">
              Режим Google Workspace отключён. Публичный портал и редактор статей
              продолжают работать.
            </Alert>
          ) : (
            <p style={{ marginTop: "1rem" }}>
              <Link href="/admin/integrations/google" variant="standalone">
                Открыть Google Workspace
              </Link>
            </p>
          )}
        </section>
      </Stack>
    </Container>
  );
}
