"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Link } from "@/components/ui";
import { Inline } from "@/components/layout";
import type { ContentStatus } from "@/domain/shared/status";
import type { AdminPromptActions } from "@/features/admin/prompts/queries";
import {
  AdminMutationClientError,
  adminPromptsApi,
} from "@/features/admin/prompts/client/admin-prompts-api";

export type PromptActionsMenuProps = {
  promptId: string;
  slug: string;
  status: ContentStatus;
  revision: number;
  actions: AdminPromptActions;
  compact?: boolean;
};

export function PromptActionsMenu({
  promptId,
  slug,
  status,
  revision,
  actions,
  compact = false,
}: PromptActionsMenuProps) {
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
      <Link href={`/admin/prompts/${promptId}`} variant={linkVariant}>
        Открыть
      </Link>
      {actions.canEdit ? (
        <Link href={`/admin/prompts/${promptId}/edit`} variant={linkVariant}>
          Редактировать
        </Link>
      ) : null}
      {actions.canPreview ? (
        <Link href={`/admin/prompts/${promptId}/preview`} variant={linkVariant}>
          Предпросмотр
        </Link>
      ) : null}
      {actions.canViewVersions ? (
        <Link href={`/admin/prompts/${promptId}/versions`} variant={linkVariant}>
          Версии
        </Link>
      ) : null}
      {actions.canOpenPublic ? (
        <Link href={`/prompts/${slug}`} variant={linkVariant}>
          На сайте
        </Link>
      ) : null}
      {actions.canHide ? (
        <Button
          size="small"
          variant="outline"
          loading={loading === "hide"}
          onClick={() =>
            runAction("hide", () => adminPromptsApi.hide(promptId, revision))
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
              adminPromptsApi.archive(promptId, revision),
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
              adminPromptsApi.restoreArchive(promptId, revision),
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
