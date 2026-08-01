import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { CreateArticleForm } from "@/features/admin/articles/components/create-article-form";
import { listAdminTaxonomyOptions } from "@/features/admin/articles/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Новая статья · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminNewArticlePage() {
  await requireAdminPrincipal();
  const taxonomy = await listAdminTaxonomyOptions();

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
              { id: "articles", label: "Статьи", href: "/admin/articles" },
              { id: "new", label: "Новая статья" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Новая статья</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Создание черновика с базовыми метаданными.
          </p>
        </header>

        {!isContentPersistenceAvailable() ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Создание статей недоступно.
          </Alert>
        ) : (
          <CreateArticleForm taxonomy={taxonomy} />
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/articles" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
