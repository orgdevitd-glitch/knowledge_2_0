import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { MediaEditor } from "@/features/admin/media/components/media-editor";
import { getAdminMediaDetail } from "@/features/admin/media/queries";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Редактор медиа · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ mediaId: string }>;

export default async function AdminMediaEditPage({
  params,
}: {
  params: Params;
}) {
  const { mediaId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminMediaDetail(principal, mediaId);

  if (!detail) {
    notFound();
  }

  const { media, actions } = detail;

  if (!actions.canEdit) {
    return (
      <Container width="wide">
        <Stack gap={3}>
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "media", label: "Медиатека", href: "/admin/media" },
              { id: "current", label: media.title },
            ]}
          />
          <Alert tone="warning" title="Редактирование недоступно">
            Метаданные нельзя редактировать в статусе{" "}
            <code>{media.status}</code>.
          </Alert>
          <Link href={`/admin/media/${mediaId}`} variant="standalone">
            К карточке файла
          </Link>
        </Stack>
      </Container>
    );
  }

  return (
    <Container width="wide">
      <Stack gap={3}>
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
              {
                id: "detail",
                label: media.title,
                href: `/admin/media/${mediaId}`,
              },
              { id: "edit", label: "Редактор" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <MediaEditor initialMedia={media} actions={actions} />
      </Stack>
    </Container>
  );
}
