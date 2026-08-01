import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { CategoryForm } from "@/features/admin/taxonomy/components/category-form";
import { listParentCategoryOptions } from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Новая категория · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminNewCategoryPage() {
  await requireAdminPrincipal();
  const persistence = isContentPersistenceAvailable();
  const parentOptions = persistence ? await listParentCategoryOptions() : [];

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
              {
                id: "categories",
                label: "Категории",
                href: "/admin/taxonomy/categories",
              },
              { id: "new", label: "Новая категория" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Новая категория</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Создание категории в дереве разделов.
          </p>
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Создание категорий недоступно.
          </Alert>
        ) : (
          <CategoryForm
            mode="create"
            parentOptions={parentOptions}
            cancelHref="/admin/taxonomy/categories"
          />
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy/categories" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
