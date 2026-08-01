import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, EmptyState, Link, NativeSelect } from "@/components/ui";
import { PromptActionsMenu } from "@/features/admin/prompts/components/prompt-actions-menu";
import { actionsForStatus, listAdminTaxonomyOptions } from "@/features/admin/prompts/queries";
import { listAdminPrompts } from "@/features/admin/prompts/list-admin-prompts";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Промты · Админ",
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

export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requireAdminPrincipal();
  const params = await searchParams;
  const status = first(params.status);
  const q = first(params.q);
  const category = first(params.category);
  const tag = first(params.tag);
  const audience = first(params.audience);
  const sourceType = first(params.sourceType);
  const sort = first(params.sort);
  const cursor = first(params.cursor);

  const [page, taxonomy] = await Promise.all([
    listAdminPrompts(principal, {
      status,
      q,
      category,
      tag,
      audience,
      sourceType,
      cursor,
      sort,
    }),
    listAdminTaxonomyOptions(),
  ]);

  const { dashboard } = page;
  const filterBase = {
    status,
    q,
    category,
    tag,
    audience,
    sourceType,
    sort: sort ?? "updated-desc",
  };

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
              { id: "prompts", label: "Промты" },
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
            <h1 style={{ margin: "0 0 0.35rem" }}>Промты</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Управление библиотекой промтов.
            </p>
          </div>
          {page.persistenceMode !== "unavailable" ? (
            <Link href="/admin/prompts/new" variant="standalone">
              + Создать промт
            </Link>
          ) : null}
        </header>

        {page.persistenceMode === "unavailable" ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Список промтов недоступен до конфигурации
            persistence.
          </Alert>
        ) : null}

        {page.scanLimitExceeded ? (
          <Alert tone="warning" title="Превышен лимит сканирования">
            Полнотекстовый поиск ограничен окном сканирования. Уточните запрос
            или фильтры — часть коллекции могла не попасть в выборку.
          </Alert>
        ) : null}

        {page.persistenceMode !== "unavailable" ? (
          <section aria-labelledby="dashboard-heading">
            <h2 id="dashboard-heading" style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
              Сводка страницы
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <Badge>
                На странице: {dashboard.total ?? "—"}
                {dashboard.incomplete ? "*" : ""}
              </Badge>
              <Badge>draft: {dashboard.draft ?? "—"}</Badge>
              <Badge tone="success">published: {dashboard.published ?? "—"}</Badge>
              <Badge>hidden: {dashboard.hidden ?? "—"}</Badge>
              <Badge tone="warning">archived: {dashboard.archived ?? "—"}</Badge>
              <Badge>Sheets: {dashboard.imported ?? "—"}</Badge>
              <Badge>Ручные: {dashboard.manual ?? "—"}</Badge>
            </div>
            {dashboard.incomplete ? (
              <p style={{ margin: "0.5rem 0 0", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
                * Счётчики относятся к текущей странице результатов, не ко всей
                коллекции.
              </p>
            ) : null}
          </section>
        ) : null}

        <form
          method="get"
          action="/admin/prompts"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}
        >
          {/* Changing filters clears cursor (not included in form). */}
          <label>
            Поиск{" "}
            <input
              name="q"
              defaultValue={q ?? ""}
              type="search"
            />
          </label>
          <label>
            Статус{" "}
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Все</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="hidden">hidden</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <NativeSelect
            label="Категория"
            name="category"
            defaultValue={category ?? ""}
            options={[
              { value: "", label: "Все" },
              ...taxonomy.categories.map((c) => ({
                value: c.id,
                label: c.title,
              })),
            ]}
          />
          <NativeSelect
            label="Тег"
            name="tag"
            defaultValue={tag ?? ""}
            options={[
              { value: "", label: "Все" },
              ...taxonomy.tags.map((t) => ({
                value: t.id,
                label: t.title,
              })),
            ]}
          />
          <NativeSelect
            label="Аудитория"
            name="audience"
            defaultValue={audience ?? ""}
            options={[
              { value: "", label: "Все" },
              ...taxonomy.audiences.map((a) => ({
                value: a.id,
                label: a.title,
              })),
            ]}
          />
          <label>
            Источник{" "}
            <select name="sourceType" defaultValue={sourceType ?? ""}>
              <option value="">Все</option>
              <option value="portal">portal</option>
              <option value="google-sheets">google-sheets</option>
              <option value="manual">manual</option>
            </select>
          </label>
          <label>
            Сортировка{" "}
            <select name="sort" defaultValue={sort ?? "updated-desc"}>
              <option value="updated-desc">updated-desc</option>
              <option value="title-asc">title-asc</option>
              <option value="created-desc">created-desc</option>
            </select>
          </label>
          <button type="submit">Применить</button>
        </form>

        {page.items.length === 0 && !page.scanLimitExceeded ? (
          <EmptyState
            title="Промтов нет"
            description="В текущем хранилище нет материалов или фильтры исключили все записи."
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
                  <th align="left">Title</th>
                  <th align="left">Slug</th>
                  <th align="left">Status</th>
                  <th align="left">Source</th>
                  <th align="right">Rev</th>
                  <th align="left">Updated</th>
                  <th align="left">Review due</th>
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
                      <code>{item.slug}</code>
                    </td>
                    <td>
                      <Badge>{item.status}</Badge>
                    </td>
                    <td>
                      <code>{item.sourceType}</code>
                    </td>
                    <td align="right">{item.revision}</td>
                    <td>{item.updatedAt.slice(0, 10)}</td>
                    <td>{item.reviewDueAt?.slice(0, 10) ?? "—"}</td>
                    <td>
                      <PromptActionsMenu
                        promptId={item.id}
                        slug={item.slug}
                        status={item.status}
                        revision={item.revision}
                        actions={actionsForStatus(item.status)}
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
            <Link
              href={`/admin/prompts${buildQuery(filterBase)}`}
              variant="standalone"
            >
              В начало
            </Link>
          ) : null}
          {page.nextCursor ? (
            <Link
              href={`/admin/prompts${buildQuery({
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
