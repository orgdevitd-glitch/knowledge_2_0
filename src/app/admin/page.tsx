import type { Metadata } from "next";

import { Container, Stack, Breadcrumbs } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { getAuthMode } from "@/config/env";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { isFirestoreConfigured } from "@/server/composition/public-content";

export const metadata: Metadata = {
  title: "Администрирование",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  const principal = await requireAdminPrincipal();
  const persistence = getAdminPersistence();

  return (
    <Container width="wide">
      <Stack gap={5}>
        <Breadcrumbs
          items={[
            { id: "admin", label: "Админ" },
          ]}
        />
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
            <h1 style={{ margin: "0 0 0.35rem" }}>Административный режим</h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              {principal.displayName ?? principal.email} · {principal.role}
            </p>
          </div>
          <AdminSignOutButton />
        </header>

        <Alert tone="information" title="Phase 5A">
          Редактор контента, публикация и предпросмотр появятся в Phase 5B. Сейчас
          доступны вход и read-only список статей.
        </Alert>

        <section aria-labelledby="infra">
          <h2 id="infra">Инфраструктура</h2>
          <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
            <li>
              Auth: <Badge>{getAuthMode()}</Badge>
            </li>
            <li>
              Persistence: <Badge>{persistence.mode}</Badge>
            </li>
            <li>
              Firestore configured:{" "}
              <Badge tone={isFirestoreConfigured() ? "success" : "warning"}>
                {isFirestoreConfigured() ? "yes" : "no"}
              </Badge>
            </li>
          </ul>
        </section>

        <p>
          <Link href="/admin/articles" variant="standalone">
            Список статей
          </Link>
        </p>
        <p>
          <Link href="/admin/integrations" variant="standalone">
            Интеграции
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
