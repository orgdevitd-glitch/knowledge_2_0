import { Container, Stack } from "@/components/layout";
import { Link } from "@/components/ui";

export default function NotFound() {
  return (
    <Container width="editorial">
      <Stack gap={4} style={{ paddingBlock: "var(--space-7)" }}>
        <h1 style={{ margin: 0 }}>Страница не найдена</h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Запрошенный материал недоступен или не существует.
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/" variant="standalone">
            На главную
          </Link>
          {" · "}
          <Link href="/materials" variant="standalone">
            К каталогу
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
