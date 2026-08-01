import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { CategoryEditPanel } from "@/features/admin/taxonomy/components/category-edit-panel";
import {
  getCategoryDetail,
  getTaxonomyUsageSummary,
  listParentCategoryOptions,
} from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Редактирование категории · Админ",
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ categoryId: string }> };

export default async function AdminEditCategoryPage({ params }: Params) {
  await requireAdminPrincipal();
  const { categoryId } = await params;
  const persistence = isContentPersistenceAvailable();

  if (!persistence) {
    return (
      <Container width="wide">
        <Stack gap={4}>
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
              {
                id: "categories",
                label: "Категории",
                href: "/admin/taxonomy/categories",
              },
              { id: "edit", label: "Редактирование" },
            ]}
          />
          <h1 style={{ margin: 0 }}>Редактирование категории</h1>
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const [category, parentOptions, usageSummary] = await Promise.all([
    getCategoryDetail(categoryId),
    listParentCategoryOptions(categoryId),
    getTaxonomyUsageSummary("category", categoryId),
  ]);

  if (!category || !usageSummary) notFound();

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
              { id: "edit", label: category.title },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{category.title}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Редактирование категории · <code>{category.slug}</code>
          </p>
        </header>

        <CategoryEditPanel
          category={category}
          parentOptions={parentOptions}
          usageSummary={usageSummary}
        />

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy/categories" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
