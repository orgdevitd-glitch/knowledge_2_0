"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Link } from "@/components/ui";
import { Inline } from "@/components/layout";
import type { ContentStatus } from "@/domain/shared/status";
import type { AdminArticleActions } from "@/features/admin/articles/queries";
import {
  AdminMutationClientError,
  adminArticlesApi,
} from "@/features/admin/articles/client/admin-articles-api";

export type ArticleActionsMenuProps = {
  articleId: string;
  slug: string;
  status: ContentStatus;
  revision: number;
  actions: AdminArticleActions;
  compact?: boolean;
};

export function ArticleActionsMenu({
  articleId,
  slug,
  status,
  revision,
  actions,
  compact = false,
}: ArticleActionsMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>,
    redirect?: string,
  ) => {
    setLoading(key);
    try {
      await fn();
      if (redirect) {
        router.push(redirect);
      } else {
        router.refresh();
      }
    } catch (err) {
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка операции";
      window.alert(msg);
    } finally {
      setLoading(null);
    }
  };

  const linkVariant = compact ? "subtle" : "standalone";

  return (
    <Inline gap={2} wrap>
      <Link href={`/admin/articles/${articleId}`} variant={linkVariant}>
        Открыть
      </Link>
      {actions.canEdit ? (
        <Link href={`/admin/articles/${articleId}/edit`} variant={linkVariant}>
          Редактировать
        </Link>
      ) : null}
      {actions.canPreview ? (
        <Link href={`/admin/articles/${articleId}/preview`} variant={linkVariant}>
          Предпросмотр
        </Link>
      ) : null}
      {actions.canViewVersions ? (
        <Link href={`/admin/articles/${articleId}/versions`} variant={linkVariant}>
          Версии
        </Link>
      ) : null}
      {actions.canOpenPublic ? (
        <Link href={`/articles/${slug}`} variant={linkVariant}>
          На сайте
        </Link>
      ) : null}
      {actions.canHide ? (
        <Button
          size="small"
          variant="outline"
          loading={loading === "hide"}
          onClick={() =>
            runAction("hide", () => adminArticlesApi.hide(articleId, revision))
          }
        >
          Скрыть
        </Button>
      ) : null}
      {actions.canArchive ? (
        <Button
          size="small"
          variant="outline"
          loading={loading === "archive"}
          onClick={() =>
            runAction("archive", () =>
              adminArticlesApi.archive(articleId, revision),
            )
          }
        >
          В архив
        </Button>
      ) : null}
      {actions.canRestoreArchive ? (
        <Button
          size="small"
          variant="secondary"
          loading={loading === "restore"}
          onClick={() =>
            runAction("restore", () =>
              adminArticlesApi.restoreArchive(articleId, revision),
            )
          }
        >
          Восстановить
        </Button>
      ) : null}
      {status !== "archived" ? (
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
          rev {revision}
        </span>
      ) : null}
    </Inline>
  );
}
