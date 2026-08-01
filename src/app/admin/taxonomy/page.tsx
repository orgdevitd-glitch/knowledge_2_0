import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { getTaxonomyDashboard } from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

import styles from "@/features/admin/taxonomy/components/taxonomy.module.css";

export const metadata: Metadata = {
  title: "Таксономия · Админ",
  robots: { index: false, follow: false },
};

function sectionStatsText(stats: {
  activeCount: number;
  archivedCount: number;
  totalCount: number;
  usedCount: number;
  unusedCount: number;
}): string {
  return `Всего: ${stats.totalCount} · активных: ${stats.activeCount} · в архиве: ${stats.archivedCount} · используется: ${stats.usedCount} · не используется: ${stats.unusedCount}`;
}

export default async function AdminTaxonomyDashboardPage() {
  await requireAdminPrincipal();
  const persistence = isContentPersistenceAvailable();
  const dashboard = persistence ? await getTaxonomyDashboard() : null;

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
              { id: "taxonomy", label: "Таксономия" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Таксономия</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Категории, теги и аудитории для классификации материалов.
          </p>
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Управление таксономией недоступно.
          </Alert>
        ) : dashboard ? (
          <div className={styles.dashboardGrid}>
            <section className={styles.dashboardCard} aria-labelledby="cat-dash">
              <h2 id="cat-dash" className={styles.dashboardCardTitle}>
                Категории
              </h2>
              <p className={styles.dashboardStats}>
                {sectionStatsText(dashboard.categories)}
              </p>
              <Link href="/admin/taxonomy/categories" variant="standalone">
                Управление категориями
              </Link>
            </section>

            <section className={styles.dashboardCard} aria-labelledby="tag-dash">
              <h2 id="tag-dash" className={styles.dashboardCardTitle}>
                Теги
              </h2>
              <p className={styles.dashboardStats}>
                {sectionStatsText(dashboard.tags)}
              </p>
              <Link href="/admin/taxonomy/tags" variant="standalone">
                Управление тегами
              </Link>
            </section>

            <section className={styles.dashboardCard} aria-labelledby="aud-dash">
              <h2 id="aud-dash" className={styles.dashboardCardTitle}>
                Аудитории
              </h2>
              <p className={styles.dashboardStats}>
                {sectionStatsText(dashboard.audiences)}
              </p>
              <Link href="/admin/taxonomy/audiences" variant="standalone">
                Управление аудиториями
              </Link>
            </section>
          </div>
        ) : null}

        <p style={{ margin: 0 }}>
          <Link href="/admin" variant="subtle">
            Назад
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
