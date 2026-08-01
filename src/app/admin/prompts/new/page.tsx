import type { Metadata } from "next";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { CreatePromptForm } from "@/features/admin/prompts/components/create-prompt-form";
import { listAdminTaxonomyOptions } from "@/features/admin/prompts/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Новый промт · Админ",
  robots: { index: false, follow: false },
};

export default async function AdminNewPromptPage() {
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
              { id: "prompts", label: "Промты", href: "/admin/prompts" },
              { id: "new", label: "Новый промт" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>Новый промт</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Создание черновика с базовыми полями и текстом промта.
          </p>
        </header>

        {!isContentPersistenceAvailable() ? (
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен. Создание промтов недоступно.
          </Alert>
        ) : (
          <CreatePromptForm taxonomy={taxonomy} />
        )}

        <p style={{ margin: 0 }}>
          <Link href="/admin/prompts" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
