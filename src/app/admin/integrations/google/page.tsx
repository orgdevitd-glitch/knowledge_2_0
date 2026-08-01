import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { GoogleConnectionActions } from "@/features/integrations/google/components/google-connection-actions";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { getGoogleWorkspaceMode } from "@/config/env";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { getIntegrationPorts } from "@/server/composition/integration-ports";

export const metadata: Metadata = {
  title: "Google Workspace · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminGoogleIntegrationsPage() {
  await requireAdminPrincipal();
  const mode = getGoogleWorkspaceMode();
  const enabled = isGoogleWorkspaceEnabled();

  let activeSourceCount = 0;
  let recentImports: Array<{
    id: string;
    status: string;
    importType: string;
    createdAt: string;
  }> = [];

  if (enabled) {
    try {
      const ports = await getIntegrationPorts();
      const [sources, imports] = await Promise.all([
        ports.sources.listActive(100),
        ports.importJobs.listRecent(10),
      ]);
      activeSourceCount = sources.length;
      recentImports = imports.map((job) => ({
        id: job.id,
        status: job.status,
        importType: job.importType,
        createdAt: job.createdAt,
      }));
    } catch {
      // Safe degraded view
    }
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
              { id: "google", label: "Google Workspace" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Google Workspace</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Режим: <Badge>{mode}</Badge>. Импорт только в черновики после
            подтверждения.
          </p>
        </header>

        {!enabled ? (
          <Alert tone="warning" title="Интеграция отключена">
            Установите GOOGLE_WORKSPACE_MODE=service-account и Shared Drive /
            root folder для ручного импорта.
          </Alert>
        ) : (
          <>
            <section aria-labelledby="status-heading">
              <h2 id="status-heading">Состояние</h2>
              <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
                <li>Активных источников: {activeSourceCount}</li>
                <li>
                  <Link href="/admin/integrations/google/sources" variant="standalone">
                    Источники
                  </Link>
                </li>
                <li>
                  <Link href="/admin/integrations/google/imports" variant="standalone">
                    Импорты
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/integrations/google/sources/new"
                    variant="standalone"
                  >
                    Добавить источник
                  </Link>
                </li>
              </ul>
              <GoogleConnectionActions />
            </section>

            <section aria-labelledby="recent-heading">
              <h2 id="recent-heading">Последние импорты</h2>
              {recentImports.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }}>Пока нет операций.</p>
              ) : (
                <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
                  {recentImports.map((job) => (
                    <li key={job.id}>
                      <Link
                        href={`/admin/integrations/google/imports/${job.id}`}
                        variant="standalone"
                      >
                        {job.importType}
                      </Link>{" "}
                      · {job.status} · {job.createdAt}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Stack>
    </Container>
  );
}
