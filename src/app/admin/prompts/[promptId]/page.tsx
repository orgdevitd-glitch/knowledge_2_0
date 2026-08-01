import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Badge, Link } from "@/components/ui";
import { PromptActionsMenu } from "@/features/admin/prompts/components/prompt-actions-menu";
import { PromptSourceSummary } from "@/features/admin/prompts/components/prompt-source-summary";
import { getAdminPromptDetail } from "@/features/admin/prompts/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Промт · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ promptId: string }>;

export default async function AdminPromptDetailPage({
  params,
}: {
  params: Params;
}) {
  const { promptId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminPromptDetail(principal, promptId);

  if (!detail) {
    notFound();
  }

  const { prompt, source, actions, recentAudit } = detail;

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
              { id: "prompts", label: "Промты", href: "/admin/prompts" },
              { id: "current", label: prompt.title },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{prompt.title}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            <Badge>{prompt.status}</Badge>
            {" · "}
            rev {prompt.revision}
            {" · "}
            <code>{prompt.sourceType}</code>
          </p>
        </header>

        <PromptActionsMenu
          promptId={prompt.id}
          slug={prompt.slug}
          status={prompt.status}
          revision={prompt.revision}
          actions={actions}
        />

        <section aria-labelledby="meta-detail">
          <h2 id="meta-detail">Метаданные</h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "10rem 1fr",
              gap: "0.35rem 1rem",
              margin: 0,
            }}
          >
            <dt>Slug</dt>
            <dd style={{ margin: 0 }}>
              <code>{prompt.slug}</code>
            </dd>
            <dt>Summary</dt>
            <dd style={{ margin: 0 }}>{prompt.summary ?? "—"}</dd>
            <dt>Создано</dt>
            <dd style={{ margin: 0 }}>{prompt.createdAt.slice(0, 19)}</dd>
            <dt>Обновлено</dt>
            <dd style={{ margin: 0 }}>{prompt.updatedAt.slice(0, 19)}</dd>
            <dt>Опубликовано</dt>
            <dd style={{ margin: 0 }}>{prompt.publishedAt?.slice(0, 19) ?? "—"}</dd>
            <dt>Пересмотр</dt>
            <dd style={{ margin: 0 }}>{prompt.reviewDueAt?.slice(0, 10) ?? "—"}</dd>
            <dt>Owner</dt>
            <dd style={{ margin: 0 }}>
              <code>{prompt.ownerId ?? "—"}</code>
            </dd>
            <dt>Текущая версия</dt>
            <dd style={{ margin: 0 }}>
              <code>{prompt.currentVersion ?? "—"}</code>
            </dd>
            <dt>Опублик. версия</dt>
            <dd style={{ margin: 0 }}>
              <code>{prompt.publishedVersion ?? "—"}</code>
            </dd>
          </dl>
        </section>

        <section aria-labelledby="source-heading">
          <h2 id="source-heading">Источник</h2>
          <PromptSourceSummary source={source} />
        </section>

        <section aria-labelledby="audit-heading">
          <h2 id="audit-heading">Последние события аудита</h2>
          {recentAudit.length === 0 ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Записей аудита пока нет.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr>
                    <th align="left">Время</th>
                    <th align="left">Событие</th>
                    <th align="left">Актор</th>
                    <th align="left">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudit.map((e) => (
                    <tr
                      key={e.id}
                      style={{ borderTop: "1px solid var(--color-border)" }}
                    >
                      <td>{e.occurredAt.slice(0, 19)}</td>
                      <td>
                        <code>{e.eventType}</code>
                      </td>
                      <td>
                        <code>{e.actorId}</code>
                      </td>
                      <td>{e.changeSummary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p style={{ margin: 0 }}>
          <Link href="/admin/prompts" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
