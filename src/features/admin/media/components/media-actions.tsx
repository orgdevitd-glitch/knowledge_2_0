"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Inline } from "@/components/layout";
import { Button, Link } from "@/components/ui";
import type { AdminMediaDto } from "@/features/admin/media/admin-media-dto";
import type { AdminMediaActions } from "@/features/admin/media/queries";
import {
  AdminMutationClientError,
  adminMediaApi,
  uploadMediaBinary,
} from "@/features/admin/media/client/admin-media-api";

export type MediaActionsProps = {
  mediaId: string;
  media: AdminMediaDto;
  actions: AdminMediaActions;
  compact?: boolean;
};

export function MediaActions({
  mediaId,
  media,
  actions,
  compact = false,
}: MediaActionsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState(false);

  const linkVariant = compact ? "subtle" : "standalone";

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
      setPendingRetry(false);
    }
  };

  const startRetry = () => {
    setPendingRetry(true);
    fileInputRef.current?.click();
  };

  const onRetryFile = async (file: File | null) => {
    if (!file) {
      setPendingRetry(false);
      return;
    }
    setLoading("retry");
    try {
      const session = actions.canReissue
        ? await adminMediaApi.reissueUpload(mediaId, media.revision)
        : await adminMediaApi.retry(mediaId, media.revision);
      await uploadMediaBinary(
        session.uploadUrl,
        file,
        session.requiredHeaders ?? {
          "Content-Type": "application/octet-stream",
        },
      );
      await adminMediaApi.complete(session.media.id, session.media.revision);
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Ошибка повторной загрузки";
      window.alert(msg);
    } finally {
      setLoading(null);
      setPendingRetry(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Inline gap={2} wrap>
      <Link href={`/admin/media/${mediaId}`} variant={linkVariant}>
        Открыть
      </Link>
      {actions.canEdit ? (
        <Link href={`/admin/media/${mediaId}/edit`} variant={linkVariant}>
          Редактировать
        </Link>
      ) : null}
      {actions.canArchive ? (
        <Button
          size="small"
          variant="outline"
          loading={loading === "archive"}
          onClick={() =>
            runAction("archive", () =>
              adminMediaApi.archive(mediaId, media.revision),
            )
          }
        >
          В архив
        </Button>
      ) : null}
      {actions.canRestore ? (
        <Button
          size="small"
          variant="secondary"
          loading={loading === "restore"}
          onClick={() =>
            runAction("restore", () =>
              adminMediaApi.restore(mediaId, media.revision),
            )
          }
        >
          Восстановить
        </Button>
      ) : null}
      {actions.canRetry || actions.canReissue ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => onRetryFile(e.target.files?.[0] ?? null)}
          />
          <Button
            size="small"
            variant="outline"
            loading={loading === "retry" || pendingRetry}
            onClick={startRetry}
          >
            {actions.canReissue ? "Продолжить загрузку" : "Повторить загрузку"}
          </Button>
        </>
      ) : null}
      <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
        rev {media.revision}
      </span>
    </Inline>
  );
}
