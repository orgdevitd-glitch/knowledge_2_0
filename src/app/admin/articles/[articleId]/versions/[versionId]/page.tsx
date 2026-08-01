import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Badge, Link } from "@/components/ui";
import type { ContentBlock } from "@/domain/content/blocks";
import { RestoreVersionButton } from "@/features/admin/articles/components/restore-version-button";
import { getAdminVersionDetail } from "@/features/admin/articles/queries";
import { ArticleBlocks } from "@/features/public-content/rendering/block-registry";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Снимок версии · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ articleId: string; versionId: string }>;

function blocksFromSnapshot(snapshot: Record<string, unknown>): ContentBlock[] {
  const raw = snapshot.blocks;
  if (!Array.isArray(raw)) return [];
  return raw as ContentBlock[];
}

export default async function AdminVersionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { articleId, versionId } = await params;
  const principal = await requireAdminPrincipal();
  const detail = await getAdminVersionDetail(principal, articleId, versionId);

  if (!detail) {
    notFound();
  }

  const { article, version, actions } = detail;
  const snapshot = version.snapshot as Record<string, unknown>;
  const blocks = blocksFromSnapshot(snapshot);
  const snapshotTitle =
    typeof snapshot.title === "string" ? snapshot.title : article.title;

  return (
    <Container width="editorial">
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
              {
                id: "detail",
                label: article.title,
                href: `/admin/articles/${articleId}`,
              },
              {
                id: "versions",
                label: "Версии",
                href: `/admin/articles/${articleId}/versions`,
              },
              { id: "version", label: `v${version.versionNumber}` },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>
            Версия {version.versionNumber}: {snapshotTitle}
          </h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {version.createdAt.slice(0, 19)} ·{" "}
            <code>{version.createdBy}</code>
            {version.isPublishedVersion ? (
              <>
                {" · "}
                <Badge tone="success">Опубликованная</Badge>
              </>
            ) : null}
          </p>
          {version.changeSummary ? (
            <p style={{ margin: "0.35rem 0 0" }}>{version.changeSummary}</p>
          ) : null}
        </header>

        <Alert tone="information" title="Снимок версии">
          Только для чтения. Восстановление создаст новый черновик на основе
          этого снимка.
        </Alert>

        {actions.canEdit ? (
          <RestoreVersionButton
            articleId={articleId}
            versionId={versionId}
            expectedRevision={article.revision}
          />
        ) : null}

        <ArticleBlocks
          blocks={blocks}
          ctx={{
            toc: [],
            promptLookup: {},
            relatedMaterials: [],
          }}
        />

        <p style={{ margin: 0 }}>
          <Link
            href={`/admin/articles/${articleId}/versions`}
            variant="subtle"
          >
            Назад к версиям
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
