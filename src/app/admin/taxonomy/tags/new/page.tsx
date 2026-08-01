import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { TagForm } from "@/features/admin/taxonomy/components/tag-form";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Новый тег · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminNewTagPage() {
  await requireAdminPrincipal();
  const persistence = isContentPersistenceAvailable();

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
              { id: "tags", label: "Теги", href: "/admin/taxonomy/tags" },
              { id: "new", label: "Новый тег" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Новый тег</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Создание метки для материалов.
          </p>
        </header>

        {!persistence ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Создание тегов недоступно.
          </Alert>
        ) : (
          <TagForm mode="create" cancelHref="/admin/taxonomy/tags" />
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy/tags" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
