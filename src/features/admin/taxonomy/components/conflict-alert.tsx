"use client";

import { Alert, Button } from "@/components/ui";
import { Inline } from "@/components/layout";

export type TaxonomyConflictAlertProps = {
  onReload: () => void;
};

export function TaxonomyConflictAlert({ onReload }: TaxonomyConflictAlertProps) {
  return (
    <Alert tone="warning" title="Конфликт версий">
      Запись была изменена в другой сессии. Обновите данные с сервера, чтобы
      продолжить редактирование актуальной версии.
      <Inline gap={2} style={{ marginTop: "0.75rem" }}>
        <Button size="small" variant="secondary" onClick={onReload}>
          Обновить данные
        </Button>
      </Inline>
    </Alert>
  );
}
