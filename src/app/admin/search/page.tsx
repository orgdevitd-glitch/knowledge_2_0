import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import { requireAdminPrincipal } from "@/server/auth/guard";
import {
  getSearchIndex,
  getSearchIndexFailureRepository,
} from "@/server/composition/search-ports";
import { getSearchLimits } from "@/config/search-env";
import { SearchAdminActions } from "@/features/admin/search/search-admin-actions";

export const metadata: Metadata = {
  title: "Поисковый индекс",
  robots: { index: false, follow: false },
};

export default async function AdminSearchPage() {
  await requireAdminPrincipal();
  const limits = getSearchLimits();
  let status;
  let failures: Awaited<
    ReturnType<ReturnType<typeof getSearchIndexFailureRepository>["listUnresolved"]>
  > = [];
  let loadError: string | null = null;
  try {
    status = await getSearchIndex().getStatus();
    failures = await getSearchIndexFailureRepository().listUnresolved(20);
  } catch {
    loadError = "Не удалось загрузить состояние индекса";
    status = {
      mode: limits.indexMode,
      generationId: null,
      createdAt: null,
      documentCount: 0,
      activeDocumentCount: 0,
      previousGenerationId: null,
      validationStatus: "unavailable",
    };
  }

  return (
    <Container width="wide">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "admin", label: "Админ", href: "/admin" },
            { id: "search", label: "Поиск" },
          ]}
        />
        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Поисковый индекс</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Phase 8B.1 — foundation (без suggestions и ассистента).
          </p>
        </header>

        {loadError ? <Alert tone="error" title="Ошибка">{loadError}</Alert> : null}

        <section aria-labelledby="status">
          <h2 id="status">Состояние</h2>
          <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
            <li>
              Mode: <Badge>{status.mode}</Badge>
            </li>
            <li>
              Validation: <Badge>{status.validationStatus}</Badge>
            </li>
            <li>Generation: {status.generationId ?? "—"}</li>
            <li>Created: {status.createdAt ?? "—"}</li>
            <li>
              Documents: {status.documentCount} (active{" "}
              {status.activeDocumentCount})
            </li>
            <li>Unresolved failures: {failures.length}</li>
          </ul>
        </section>

        <section aria-labelledby="failures">
          <h2 id="failures">Ошибки индексации</h2>
          {failures.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>Нет открытых ошибок.</p>
          ) : (
            <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
              {failures.map((f) => (
                <li key={f.id}>
                  {f.entityType}/{f.entityId}: {f.failureCode} (×{f.attemptCount})
                </li>
              ))}
            </ul>
          )}
        </section>

        <SearchAdminActions />

        <p>
          <Link href="/admin" variant="standalone">
            Назад в админ
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
