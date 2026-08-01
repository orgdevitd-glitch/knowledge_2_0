import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge } from "@/components/ui";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { ImportConfirmPanel } from "@/features/integrations/google/components/import-confirm-panel";
import { SheetsPreviewTable } from "@/features/integrations/google/components/sheets-preview-table";
import { StructuralDiffSummary } from "@/features/integrations/google/components/structural-diff-summary";
import type { StructuralArticleDiff } from "@/features/integrations/google/application/structural-diff";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { isImportJobExpired } from "@/domain/integrations/import-job";

export const metadata: Metadata = {
  title: "Preview импорта · Админ",
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ importJobId: string }> };

export default async function GoogleImportJobPage({ params }: Params) {
  await requireAdminPrincipal();
  if (!isGoogleWorkspaceEnabled()) {
    return (
      <Container width="wide">
        <Alert tone="warning" title="Интеграция отключена">
          Preview недоступен.
        </Alert>
      </Container>
    );
  }

  const { importJobId } = await params;
  const ports = await getIntegrationPorts();
  const job = await ports.importJobs.getById(importJobId);
  if (!job) notFound();

  const expired = isImportJobExpired(job);
  const preview = job.preview as Record<string, unknown> | null;
  const draft =
    preview && typeof preview === "object" && "draft" in preview
      ? (preview.draft as Record<string, unknown>)
      : null;
  const metrics =
    preview && typeof preview === "object" && "metrics" in preview
      ? (preview.metrics as Record<string, number>)
      : null;
  const items =
    preview && typeof preview === "object" && Array.isArray(preview.items)
      ? (preview.items as Array<Record<string, unknown>>)
      : [];

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
              { id: "imports", label: "Импорты", href: "/admin/integrations/google/imports" },
              { id: "job", label: job.id },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Preview импорта</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            <Badge>{job.importType}</Badge> <Badge>{job.status}</Badge>
            {expired ? <Badge tone="warning">expired</Badge> : null}
          </p>
        </header>

        {job.errors.length > 0 ? (
          <Alert tone="error" title="Ошибки">
            <ul>
              {job.errors.slice(0, 20).map((err, index) => (
                <li key={`${err.code}-${index}`}>
                  {err.code}: {err.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {job.warnings.length > 0 ? (
          <Alert tone="warning" title="Предупреждения">
            <ul>
              {job.warnings.slice(0, 30).map((warn, index) => (
                <li key={`${warn.code}-${index}`}>
                  {warn.code}: {warn.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {draft ? (
          <section aria-labelledby="docs-preview">
            <h2 id="docs-preview">Статья</h2>
            <p>
              <strong>{String(draft.proposedTitle ?? "")}</strong>
            </p>
            <p style={{ color: "var(--color-text-muted)" }}>
              slug: {String(draft.proposedSlug ?? "")}
            </p>
            <p>Блоков: {Array.isArray(draft.blocks) ? draft.blocks.length : 0}</p>
            {Array.isArray(draft.unsupportedElements) &&
            draft.unsupportedElements.length > 0 ? (
              <Alert tone="information" title="Неподдерживаемые элементы">
                {draft.unsupportedElements.length} элемент(ов) потребуют ручной
                доработки (например, изображения).
              </Alert>
            ) : null}
            {preview &&
            "diff" in preview &&
            preview.diff &&
            typeof preview.diff === "object" ? (
              <StructuralDiffSummary
                diff={preview.diff as StructuralArticleDiff}
              />
            ) : null}
          </section>
        ) : null}

        {metrics ? (
          <section aria-labelledby="sheets-preview">
            <h2 id="sheets-preview">Промты</h2>
            <ul>
              <li>Всего: {metrics.total ?? 0}</li>
              <li>Ready: {metrics.ready ?? 0}</li>
              <li>Warning: {metrics.warning ?? 0}</li>
              <li>Error: {metrics.error ?? 0}</li>
              <li>Новые: {metrics.create ?? 0}</li>
              <li>Обновления: {metrics.update ?? 0}</li>
            </ul>
            <SheetsPreviewTable items={items} />
          </section>
        ) : null}

        <ImportConfirmPanel
          importJobId={job.id}
          importType={job.importType}
          status={job.status}
          expired={expired}
          hasErrors={job.errors.length > 0 || job.status === "invalid"}
        />
      </Stack>
    </Container>
  );
}
