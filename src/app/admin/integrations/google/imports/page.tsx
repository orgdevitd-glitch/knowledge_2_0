import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, EmptyState, Link } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { getIntegrationPorts } from "@/server/composition/integration-ports";

export const metadata: Metadata = {
  title: "Импорты Google · Админ",
  robots: { index: false, follow: false },
};

export default async function GoogleImportsPage() {
  await requireAdminPrincipal();
  if (!isGoogleWorkspaceEnabled()) {
    return (
      <Container width="wide">
        <Alert tone="warning" title="Интеграция отключена">
          Импорты недоступны.
        </Alert>
      </Container>
    );
  }

  const ports = await getIntegrationPorts();
  const jobs = await ports.importJobs.listRecent(50);

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
              { id: "imports", label: "Импорты" },
            ]}
          />
          <AdminSignOutButton />
        </div>
        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Импорты</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Preview и подтверждённые операции.
          </p>
        </header>
        {jobs.length === 0 ? (
          <EmptyState title="Нет импортов" description="Создайте preview из источника." />
        ) : (
          <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/admin/integrations/google/imports/${job.id}`}
                  variant="standalone"
                >
                  {job.importType}
                </Link>{" "}
                · {job.status} · ошибок: {job.errors.length} · {job.createdAt}
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </Container>
  );
}
