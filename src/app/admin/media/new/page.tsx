import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { MediaUploadForm } from "@/features/admin/media/components/upload-form";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Загрузка медиа · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminNewMediaPage() {
  await requireAdminPrincipal();

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
              { id: "new", label: "Загрузка" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Загрузка файла</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Выберите файл, укажите метаданные и загрузите в медиатеку.
          </p>
        </header>

        {!isContentPersistenceAvailable() ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Загрузка недоступна.
          </Alert>
        ) : (
          <MediaUploadForm />
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/media" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
