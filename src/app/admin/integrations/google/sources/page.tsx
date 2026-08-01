import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, EmptyState, Link } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { SourceActions } from "@/features/integrations/google/components/source-actions";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { getIntegrationPorts } from "@/server/composition/integration-ports";

export const metadata: Metadata = {
  title: "Источники Google · Админ",
  robots: { index: false, follow: false },
};

export default async function GoogleSourcesPage() {
  await requireAdminPrincipal();
  const enabled = isGoogleWorkspaceEnabled();

  if (!enabled) {
    return (
      <Container width="wide">
        <Alert tone="warning" title="Интеграция отключена">
          Google Workspace недоступен.
        </Alert>
      </Container>
    );
  }

  const ports = await getIntegrationPorts();
  const sources =
    (await ports.sources.listRecent?.(100)) ??
    (await ports.sources.listActive(100));

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
              { id: "sources", label: "Источники" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 0.35rem" }}>Источники</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Подключённые Google Docs и Sheets.
            </p>
          </div>
          <Link href="/admin/integrations/google/sources/new" variant="standalone">
            + Добавить
          </Link>
        </header>

        {sources.length === 0 ? (
          <EmptyState
            title="Нет источников"
            description="Добавьте Google Doc или Sheet по ссылке или через браузер Drive."
          />
        ) : (
          <div role="table" aria-label="Источники Google">
            {sources.map((source) => (
              <div
                key={source.id}
                role="row"
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  padding: "1rem 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div>
                  <Link
                    href={`/admin/integrations/google/sources/${source.id}`}
                    variant="standalone"
                  >
                    {source.displayName}
                  </Link>{" "}
                  <Badge>{source.sourceType}</Badge>{" "}
                  <Badge
                    tone={
                      source.status === "active"
                        ? "success"
                        : source.status === "access-lost"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {source.status}
                  </Badge>
                </div>
                <div style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                  Цель: {source.targetEntityType}
                  {source.targetEntityId ? ` · ${source.targetEntityId}` : ""}
                  {source.lastImportedAt
                    ? ` · импорт ${source.lastImportedAt}`
                    : ""}
                </div>
                <SourceActions sourceId={source.id} archived={source.status === "archived"} />
              </div>
            ))}
          </div>
        )}
      </Stack>
    </Container>
  );
}
