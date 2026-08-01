"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import {
  AdminMutationClientError,
  adminPromptsApi,
} from "@/features/admin/prompts/client/admin-prompts-api";

export type RestorePromptVersionButtonProps = {
  promptId: string;
  versionId: string;
  expectedRevision: number;
};

export function RestorePromptVersionButton({
  promptId,
  versionId,
  expectedRevision,
}: RestorePromptVersionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    const ok = window.confirm(
      "Восстановить эту версию? Текущий черновик будет заменён содержимым снимка.",
    );
    if (!ok) return;

    setLoading(true);
    try {
      await adminPromptsApi.restoreVersion(
        promptId,
        versionId,
        expectedRevision,
        "Восстановление из версии",
      );
      router.push(`/admin/prompts/${promptId}/edit`);
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
