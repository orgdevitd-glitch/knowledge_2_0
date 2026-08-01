import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { TagEditPanel } from "@/features/admin/taxonomy/components/tag-edit-panel";
import { getTagDetail, getTaxonomyUsageSummary } from "@/features/admin/taxonomy/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";

export const metadata: Metadata = {
  title: "Редактирование тега · Админ",
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ tagId: string }> };

export default async function AdminEditTagPage({ params }: Params) {
  await requireAdminPrincipal();
  const { tagId } = await params;
  const persistence = isContentPersistenceAvailable();

  if (!persistence) {
    return (
      <Container width="wide">
        <Stack gap={4}>
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "taxonomy", label: "Таксономия", href: "/admin/taxonomy" },
              { id: "tags", label: "Теги", href: "/admin/taxonomy/tags" },
              { id: "edit", label: "Редактирование" },
            ]}
          />
          <h1 style={{ margin: 0 }}>Редактирование тега</h1>
          <Alert tone="warning" title="Хранилище не подключено">
            Firestore не настроен.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const [tag, usageSummary] = await Promise.all([
    getTagDetail(tagId),
    getTaxonomyUsageSummary("tag", tagId),
  ]);
  if (!tag || !usageSummary) notFound();

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
              { id: "edit", label: tag.title },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{tag.title}</h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Редактирование тега · <code>{tag.slug}</code>
          </p>
        </header>

        <TagEditPanel tag={tag} usageSummary={usageSummary} />

        <p style={{ margin: 0 }}>
          <Link href="/admin/taxonomy/tags" variant="subtle">
            Назад к списку
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
