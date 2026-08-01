import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import type { PromptSnapshot } from "@/domain/content/prompt";
import { RestorePromptVersionButton } from "@/features/admin/prompts/components/restore-prompt-version-button";
import { getAdminPromptVersionDetail } from "@/features/admin/prompts/queries";
import { PromptCopyButton } from "@/features/public-content/rendering/prompt-copy-button";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Снимок версии промта · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ promptId: string; versionId: string }>;

function snapshotFromRecord(
  snapshot: Record<string, unknown>,
): PromptSnapshot | null {
  if (
    typeof snapshot.title !== "string" ||
    typeof snapshot.slug !== "string" ||
    typeof snapshot.promptText !== "string"
  ) {
    return null;
  }
  return snapshot as unknown as PromptSnapshot;
}

export default async function AdminPromptVersionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { promptId, versionId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminPromptVersionDetail(
    principal,
    promptId,
    versionId,
  );

  if (!detail) {
    notFound();
  }

  const { prompt, version, actions } = detail;
  const snapshot = snapshotFromRecord(version.snapshot as Record<string, unknown>);
  const snapshotTitle = snapshot?.title ?? prompt.title;

  return (
    <Container width="editorial">
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
              { id: "prompts", label: "Промты", href: "/admin/prompts" },
              {
                id: "detail",
                label: prompt.title,
                href: `/admin/prompts/${promptId}`,
              },
              {
                id: "versions",
                label: "Версии",
                href: `/admin/prompts/${promptId}/versions`,
              },
              { id: "version", label: `v${version.versionNumber}` },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>
            Версия {version.versionNumber}: {snapshotTitle}
          </h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {version.createdAt.slice(0, 19)} ·{" "}
            <code>{version.createdBy}</code>
            {version.isPublishedVersion ? (
              <>
                {" · "}
                <Badge tone="success">Опубликованная</Badge>
              </>
            ) : null}
          </p>
          {version.changeSummary ? (
            <p style={{ margin: "0.35rem 0 0" }}>{version.changeSummary}</p>
          ) : null}
        </header>

        <Alert tone="information" title="Снимок версии">
          Только для чтения. Восстановление создаст новый черновик на основе
          этого снимка.
        </Alert>

        {actions.canEdit ? (
          <RestorePromptVersionButton
            promptId={promptId}
            versionId={versionId}
            expectedRevision={prompt.revision}
          />
        ) : null}

        {snapshot ? (
          <>
            {snapshot.summary ? (
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                {snapshot.summary}
              </p>
            ) : null}

            <section aria-labelledby="snapshot-prompt-text">
              <h2 id="snapshot-prompt-text">Текст промта</h2>
              <pre
                style={{
                  margin: "0 0 1rem",
                  padding: "1rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "var(--color-surface-muted)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-control)",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                }}
              >
                {snapshot.promptText}
              </pre>
              <PromptCopyButton text={snapshot.promptText} />
            </section>

            {snapshot.inputRequirements ? (
              <section>
                <h2>Входные данные</h2>
                <p>{snapshot.inputRequirements}</p>
              </section>
            ) : null}
            {snapshot.outputRequirements ? (
              <section>
                <h2>Ожидаемый результат</h2>
                <p>{snapshot.outputRequirements}</p>
              </section>
            ) : null}
            {snapshot.restrictions ? (
              <section>
                <h2>Ограничения</h2>
                <p>{snapshot.restrictions}</p>
              </section>
            ) : null}
            {snapshot.usageExample ? (
              <section>
                <h2>Пример использования</h2>
                <p>{snapshot.usageExample}</p>
              </section>
            ) : null}
          </>
        ) : (
          <Alert tone="warning" title="Несовместимый снимок">
            Снимок версии не удалось прочитать как промт.
          </Alert>
        )}

        <p style={{ margin: 0 }}>
          <Link
            href={`/admin/prompts/${promptId}/versions`}
            variant="subtle"
          >
            Назад к версиям
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
