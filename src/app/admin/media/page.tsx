import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, EmptyState, Link } from "@/components/ui";
import { MediaActions } from "@/features/admin/media/components/media-actions";
import { actionsForMediaStatus } from "@/features/admin/media/queries";
import { listAdminMedia } from "@/features/admin/media/list-admin-media";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { MEDIA_KIND_VALUES, MEDIA_STATUS_VALUES } from "@/domain/shared/media-limits";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Медиатека · Админ",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function buildQuery(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requireAdminPrincipal();
  const params = await searchParams;
  const status = first(params.status);
  const kind = first(params.kind);
  const q = first(params.q);
  const cursor = first(params.cursor);

  const page = await listAdminMedia(principal, { status, kind, q, cursor });

  const filterBase = { status, kind, q };

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
              { id: "media", label: "Медиатека" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 0.35rem" }}>Медиатека</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Загрузка и управление изображениями и документами.
            </p>
          </div>
          {page.persistenceMode !== "unavailable" ? (
            <Link href="/admin/media/new" variant="standalone">
              + Загрузить файл
            </Link>
          ) : null}
        </header>

        {page.persistenceMode === "unavailable" ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Медиатека недоступна до конфигурации
            persistence.
          </Alert>
        ) : null}

        {page.scanLimitExceeded ? (
          <Alert tone="warning" title="Превышен лимит сканирования">
            Поиск ограничен окном сканирования. Уточните запрос или фильтры —
            часть коллекции могла не попасть в выборку.
          </Alert>
        ) : null}

        <form
          method="get"
          action="/admin/media"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <label>
            Поиск{" "}
            <input name="q" defaultValue={q ?? ""} type="search" />
          </label>
          <label>
            Статус{" "}
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Все</option>
              {MEDIA_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Тип{" "}
            <select name="kind" defaultValue={kind ?? ""}>
              <option value="">Все</option>
              {MEDIA_KIND_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Применить</button>
        </form>

        {page.items.length === 0 && !page.scanLimitExceeded ? (
          <EmptyState
            title="Файлов нет"
            description="В текущем хранилище нет медиафайлов или фильтры исключили все записи."
          />
        ) : null}

        {page.items.length === 0 && page.scanLimitExceeded ? (
          <EmptyState
            title="Ничего не найдено в окне сканирования"
            description="Запрос не дал совпадений до достижения лимита сканирования. Уточните фильтры."
          />
        ) : null}

        {page.items.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr>
                  <th align="left">Название</th>
                  <th align="left">Тип</th>
                  <th align="left">Статус</th>
                  <th align="left">Файл</th>
                  <th align="right">Размер</th>
                  <th align="right">Rev</th>
                  <th align="left">Обновлено</th>
                  <th align="left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <td>{item.title}</td>
                    <td>
                      <code>{item.kind}</code>
                    </td>
                    <td>
                      <Badge
                        tone={
                          item.status === "ready"
                            ? "success"
                            : item.status === "failed"
                              ? "error"
                              : item.status === "archived"
                                ? "warning"
                                : undefined
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td>
                      <code>{item.originalFileName}</code>
                    </td>
                    <td align="right">{formatBytes(item.sizeBytes)}</td>
                    <td align="right">{item.revision}</td>
                    <td>{item.updatedAt.slice(0, 10)}</td>
                    <td>
                      <MediaActions
                        mediaId={item.id}
                        media={{
                          id: item.id,
                          title: item.title,
                          description: null,
                          defaultAltText: null,
                          kind: item.kind,
                          mimeType: item.mimeType,
                          originalFileName: item.originalFileName,
                          fileExtension: "",
                          sizeBytes: item.sizeBytes,
                          width: null,
                          height: null,
                          status: item.status,
                          sourceType: "portal",
                          ownerId: "",
                          failureReasonCode: null,
                          createdAt: item.createdAt,
                          updatedAt: item.updatedAt,
                          uploadedAt: null,
                          archivedAt: null,
                          revision: item.revision,
                          publicPath: item.publicPath,
                        }}
                        actions={actionsForMediaStatus(
                          item.status as (typeof MEDIA_STATUS_VALUES)[number],
                        )}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p style={{ margin: 0, display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link href="/admin" variant="subtle">
            Назад
          </Link>
          {cursor ? (
            <Link href={`/admin/media${buildQuery(filterBase)}`} variant="standalone">
              В начало
            </Link>
          ) : null}
          {page.nextCursor ? (
            <Link
              href={`/admin/media${buildQuery({
                ...filterBase,
                cursor: page.nextCursor,
              })}`}
              variant="standalone"
            >
              Следующая страница
            </Link>
          ) : null}
        </p>
      </Stack>
    </Container>
  );
}
