import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { SourceActions } from "@/features/integrations/google/components/source-actions";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { getIntegrationPorts } from "@/server/composition/integration-ports";

export const metadata: Metadata = {
  title: "Источник Google · Админ",
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ sourceId: string }> };

export default async function GoogleSourceDetailPage({ params }: Params) {
  await requireAdminPrincipal();
  if (!isGoogleWorkspaceEnabled()) {
    return (
      <Container width="wide">
        <Alert tone="warning" title="Интеграция отключена">
          Источник недоступен.
        </Alert>
      </Container>
    );
  }

  const { sourceId } = await params;
  const ports = await getIntegrationPorts();
  const source = await ports.sources.getById(sourceId);
  if (!source) notFound();

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
              { id: "source", label: source.displayName },
            ]}
          />
          <AdminSignOutButton />
        </div>
        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{source.displayName}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            <Badge>{source.sourceType}</Badge> <Badge>{source.status}</Badge>
          </p>
        </header>
        <dl>
          <div>
            <dt>Тип цели</dt>
            <dd>{source.targetEntityType}</dd>
          </div>
          <div>
            <dt>Последний импорт</dt>
            <dd>{source.lastImportedAt ?? "—"}</dd>
          </div>
          <div>
            <dt>Изменение источника</dt>
            <dd>{source.lastKnownModifiedAt ?? "—"}</dd>
          </div>
        </dl>
        <SourceActions
          sourceId={source.id}
          archived={source.status === "archived"}
        />
        <p>
          <Link href="/admin/integrations/google/sources" variant="standalone">
            К списку источников
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
