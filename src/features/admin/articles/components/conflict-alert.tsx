"use client";

import { Alert, Button } from "@/components/ui";
import { Inline } from "@/components/layout";

export type ConflictAlertProps = {
  onRefresh: () => void;
  onKeepLocal: () => void;
};

export function ConflictAlert({ onRefresh, onKeepLocal }: ConflictAlertProps) {
  return (
    <Alert tone="warning" title="Конфликт версий">
      Материал был изменён в другой сессии. Обновите данные с сервера или
      оставьте ваши локальные изменения.
      <Inline gap={2} style={{ marginTop: "0.75rem" }}>
        <Button size="small" variant="secondary" onClick={onRefresh}>
          Обновить данные
        </Button>
        <Button size="small" variant="outline" onClick={onKeepLocal}>
          Оставить мои изменения
        </Button>
      </Inline>
    </Alert>
  );
}
