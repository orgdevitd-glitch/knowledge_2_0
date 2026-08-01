import { Alert } from "@/components/ui";
import type { AdminPromptSourceSummary } from "@/features/admin/prompts/queries";

export type PromptSourceSummaryProps = {
  source: AdminPromptSourceSummary;
};

export function PromptSourceSummary({ source }: PromptSourceSummaryProps) {
  return (
    <div>
      {source.warning ? (
        <Alert tone="warning" title="Источник">
          {source.warning}
        </Alert>
      ) : null}
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "10rem 1fr",
          gap: "0.35rem 1rem",
          margin: source.warning ? "0.75rem 0 0" : 0,
        }}
      >
        <dt>Источник</dt>
        <dd style={{ margin: 0 }}>{source.label}</dd>
        <dt>Тип</dt>
        <dd style={{ margin: 0 }}>
          <code>{source.type}</code>
        </dd>
        {source.connectionId ? (
          <>
            <dt>SourceConnection</dt>
            <dd style={{ margin: 0 }}>
              <code>{source.connectionId}</code>
            </dd>
          </>
        ) : null}
        {source.externalId ? (
          <>
            <dt>Внешний ID</dt>
            <dd style={{ margin: 0 }}>
              <code>{source.externalId}</code>
            </dd>
          </>
        ) : null}
        {source.lastImportJobId ? (
          <>
            <dt>ImportJob</dt>
            <dd style={{ margin: 0 }}>
              <code>{source.lastImportJobId}</code>
            </dd>
          </>
        ) : null}
        {source.lastSyncAt ? (
          <>
            <dt>Последний импорт</dt>
            <dd style={{ margin: 0 }}>{source.lastSyncAt.slice(0, 19)}</dd>
          </>
        ) : null}
        {source.connectionStatus ? (
          <>
            <dt>Статус подключения</dt>
            <dd style={{ margin: 0 }}>{source.connectionStatus}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
