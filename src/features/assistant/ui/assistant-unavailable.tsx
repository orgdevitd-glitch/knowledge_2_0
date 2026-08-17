import { EmptyState, Link } from "@/components/ui";
import { Stack } from "@/components/layout";

export function AssistantUnavailable() {
  return (
    <Stack gap={4}>
      <h1 style={{ margin: 0 }}>Ассистент</h1>
      <EmptyState
        title="Ассистент пока недоступен"
        description="Используйте поиск по опубликованным материалам."
        primaryAction={
          <Link href="/search" variant="standalone">
            Открыть поиск
          </Link>
        }
      />
    </Stack>
  );
}
