import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import { CopyTextButton } from "@/features/admin/media/components/copy-text-button";
import { MediaActions } from "@/features/admin/media/components/media-actions";
import { getAdminMediaDetail } from "@/features/admin/media/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Медиафайл · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ mediaId: string }>;

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminMediaDetailPage({
  params,
}: {
  params: Params;
}) {
  const { mediaId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminMediaDetail(principal, mediaId);

  if (!detail) {
    notFound();
  }

  const { media, actions, usage, recentAudit } = detail;
  const showImagePreview =
    media.status === "ready" &&
    media.kind === "image" &&
    media.publicPath != null;

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
              { id: "media", label: "Медиатека", href: "/admin/media" },
              { id: "current", label: media.title },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{media.title}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            <Badge
              tone={
                media.status === "ready"
                  ? "success"
                  : media.status === "failed"
                    ? "error"
                    : media.status === "archived"
                      ? "warning"
                      : undefined
              }
            >
              {media.status}
            </Badge>
            {" · "}
            <code>{media.kind}</code>
            {" · "}
            rev {media.revision}
          </p>
        </header>

        <MediaActions mediaId={mediaId} media={media} actions={actions} />

        {media.status === "failed" && media.failureReasonCode ? (
          <Alert tone="error" title="Ошибка загрузки">
            Код: <code>{media.failureReasonCode}</code>
          </Alert>
        ) : null}

        {showImagePreview ? (
          <section aria-labelledby="preview-heading">
            <h2 id="preview-heading">Предпросмотр</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.publicPath!}
              alt={media.defaultAltText ?? media.title}
              style={{
                maxWidth: "100%",
                maxHeight: "24rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            />
          </section>
        ) : null}

        {media.kind === "document" && media.status === "ready" ? (
          <Alert tone="information" title="Документ">
            PDF и другие документы не отображаются inline. Используйте публичный
            путь для ссылки на скачивание.
          </Alert>
        ) : null}

        <section aria-labelledby="ids-heading">
          <h2 id="ids-heading">Идентификаторы</h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "10rem 1fr",
              gap: "0.35rem 1rem",
              margin: 0,
            }}
          >
            <dt>Media ID</dt>
            <dd style={{ margin: 0, display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <code>{media.id}</code>
              <CopyTextButton text={media.id} label="Копировать ID" />
            </dd>
            <dt>Публичный путь</dt>
            <dd style={{ margin: 0, display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              {media.publicPath ? (
                <>
                  <code>{media.publicPath}</code>
                  <CopyTextButton text={media.publicPath} label="Копировать путь" />
                </>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </section>

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
            <dt>Описание</dt>
            <dd style={{ margin: 0 }}>{media.description ?? "—"}</dd>
            <dt>Alt по умолчанию</dt>
            <dd style={{ margin: 0 }}>{media.defaultAltText ?? "—"}</dd>
            <dt>Файл</dt>
            <dd style={{ margin: 0 }}>
              <code>{media.originalFileName}</code>
            </dd>
            <dt>MIME</dt>
            <dd style={{ margin: 0 }}>
              <code>{media.mimeType ?? "—"}</code>
            </dd>
            <dt>Размер</dt>
            <dd style={{ margin: 0 }}>{formatBytes(media.sizeBytes)}</dd>
            <dt>Размеры</dt>
            <dd style={{ margin: 0 }}>
              {media.width != null && media.height != null
                ? `${media.width}×${media.height}`
                : "—"}
            </dd>
            <dt>Источник</dt>
            <dd style={{ margin: 0 }}>
              <code>{media.sourceType}</code>
            </dd>
            <dt>Owner</dt>
            <dd style={{ margin: 0 }}>
              <code>{media.ownerId}</code>
            </dd>
            <dt>Создано</dt>
            <dd style={{ margin: 0 }}>{media.createdAt.slice(0, 19)}</dd>
            <dt>Обновлено</dt>
            <dd style={{ margin: 0 }}>{media.updatedAt.slice(0, 19)}</dd>
            <dt>Загружено</dt>
            <dd style={{ margin: 0 }}>{media.uploadedAt?.slice(0, 19) ?? "—"}</dd>
            <dt>В архиве с</dt>
            <dd style={{ margin: 0 }}>{media.archivedAt?.slice(0, 19) ?? "—"}</dd>
          </dl>
        </section>

        <section aria-labelledby="usage-heading">
          <h2 id="usage-heading">Использование</h2>
          {usage.scanLimitExceeded ? (
            <Alert tone="warning" title="Сканирование неполное">
              Проверка использования прервана по лимиту. Список может быть
              неполным — не считайте файл неиспользуемым.
            </Alert>
          ) : null}
          {usage.totalReferences === 0 ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Ссылок на этот mediaId не найдено
              {usage.scanLimitExceeded ? " (в пределах сканирования)" : ""}.
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
                    <th align="left">Сущность</th>
                    <th align="left">ID</th>
                    <th align="left">Область</th>
                    <th align="left">Путь</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.references.map((ref, index) => (
                    <tr
                      key={`${ref.entityType}-${ref.entityId}-${ref.path}-${index}`}
                      style={{ borderTop: "1px solid var(--color-border)" }}
                    >
                      <td>
                        <code>{ref.entityType}</code>
                      </td>
                      <td>
                        <code>{ref.entityId}</code>
                      </td>
                      <td>
                        <code>{ref.scope}</code>
                      </td>
                      <td>
                        <code>{ref.path}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          <Link href="/admin/media" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
