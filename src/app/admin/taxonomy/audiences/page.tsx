import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, EmptyState, Link } from "@/components/ui";
import { AudienceList } from "@/features/admin/taxonomy/components/audience-list";
import { listAudiencesAdmin } from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Аудитории · Таксономия · Админ",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function parseStatus(
  raw: string | null,
): "active" | "archived" | "all" | undefined {
  if (raw === "active" || raw === "archived" || raw === "all") return raw;
  return undefined;
}

export default async function AdminAudiencesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPrincipal();
  const params = await searchParams;
  const query = first(params.q) ?? undefined;
  const status = parseStatus(first(params.status)) ?? "all";
  const persistence = isContentPersistenceAvailable();
  const audiences = persistence
    ? await listAudiencesAdmin({ query, status })
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
              { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
              { id: "audiences", label: "Аудитории" },
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
            <h1 style={{ margin: "0 0 0.35rem" }}>Аудитории</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Целевые группы для материалов базы знаний.
            </p>
          </div>
          {persistence ? (
            <Link href="/admin/taxonomy/audiences/new" variant="standalone">
              + Создать аудиторию
            </Link>
          ) : null}
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Список аудиторий недоступен.
          </Alert>
        ) : (
          <>
            <form
              method="get"
              action="/admin/taxonomy/audiences"
              style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
            >
              <label>
                Поиск{" "}
                <input
                  name="q"
                  defaultValue={query ?? ""}
                  type="search"
                />
              </label>
              <label>
                Статус{" "}
                <select name="status" defaultValue={status}>
                  <option value="all">Все</option>
                  <option value="active">Активные</option>
                  <option value="archived">В архиве</option>
                </select>
              </label>
              <button type="submit">Применить</button>
            </form>

            {audiences.length === 0 ? (
              <EmptyState
                title="Аудитории не найдены"
                description="Создайте первую аудиторию или измените фильтры."
              />
            ) : (
              <AudienceList audiences={audiences} />
            )}
          </>
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy" variant="subtle">
            Назад к таксономии
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
