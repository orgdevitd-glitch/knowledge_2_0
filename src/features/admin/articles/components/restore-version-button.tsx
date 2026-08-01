"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import {
  AdminMutationClientError,
  adminArticlesApi,
} from "@/features/admin/articles/client/admin-articles-api";

export type RestoreVersionButtonProps = {
  articleId: string;
  versionId: string;
  expectedRevision: number;
};

export function RestoreVersionButton({
  articleId,
  versionId,
  expectedRevision,
}: RestoreVersionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    const ok = window.confirm(
      "Восстановить эту версию? Текущий черновик будет заменён содержимым снимка.",
    );
    if (!ok) return;

    setLoading(true);
    try {
      await adminArticlesApi.restoreVersion(
        articleId,
        versionId,
        expectedRevision,
        "Восстановление из версии",
      );
      router.push(`/admin/articles/${articleId}/edit`);
    } catch (err) {
      const msg =
        err instanceof AdminMutationClientError
          ? err.message
          : "Не удалось восстановить версию";
      window.alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" loading={loading} onClick={handleRestore}>
      Восстановить в черновик
    </Button>
  );
}
