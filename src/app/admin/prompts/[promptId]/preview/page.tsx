import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { Alert, Link } from "@/components/ui";
import { requireAdminPrompt } from "@/features/admin/prompts/queries";
import { PromptCopyButton } from "@/features/public-content/rendering/prompt-copy-button";
import { AdminSignOutButton } from "@/features/admin/ui/sign-out-button";
import { requireAdminPrincipal } from "@/server/auth/guard";

export const metadata: Metadata = {
  title: "Предпросмотр промта · Админ",
  robots: { index: false, follow: false },
};

type Params = Promise<{ promptId: string }>;

export default async function AdminPromptPreviewPage({
  params,
}: {
  params: Params;
}) {
  const { promptId } = await params;
  const principal = await requireAdminPrincipal();
  let prompt;
  try {
    prompt = await requireAdminPrompt(principal, promptId);
  } catch {
    notFound();
  }

  return (
    <Container width="editorial">
      <Stack gap={4}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Breadcrumbs
            items={[
              { id: "admin", label: "Админ", href: "/admin" },
              { id: "prompts", label: "Промты", href: "/admin/prompts" },
              {
                id: "detail",
                label: prompt.title,
                href: `/admin/prompts/${promptId}`,
              },
              { id: "preview", label: "Предпросмотр" },
            ]}
          />
          <AdminSignOutButton />
        </div>

        <Alert tone="information" title="Режим предпросмотра">
          Это черновик или текущее состояние промта. На публичном сайте может
          отображаться другая опубликованная версия.
        </Alert>

        <header>
          <h1 style={{ margin: "0 0 0.35rem" }}>{prompt.title}</h1>
          {prompt.summary ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              {prompt.summary}
            </p>
          ) : null}
        </header>

        <section aria-labelledby="prompt-text">
          <h2 id="prompt-text">Текст промта</h2>
          <pre
            style={{
              margin: "0 0 1rem",
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--color-surface-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-control)",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: "0.9rem",
              lineHeight: 1.5,
            }}
          >
            {prompt.promptText}
          </pre>
          <PromptCopyButton text={prompt.promptText} />
        </section>

        {prompt.inputRequirements ? (
          <section>
            <h2>Входные данные</h2>
            <p>{prompt.inputRequirements}</p>
          </section>
        ) : null}
        {prompt.outputRequirements ? (
          <section>
            <h2>Ожидаемый результат</h2>
            <p>{prompt.outputRequirements}</p>
          </section>
        ) : null}
        {prompt.restrictions ? (
          <section>
            <h2>Ограничения</h2>
            <p>{prompt.restrictions}</p>
          </section>
        ) : null}
        {prompt.usageExample ? (
          <section>
            <h2>Пример использования</h2>
            <p>{prompt.usageExample}</p>
          </section>
        ) : null}

        <p style={{ margin: 0 }}>
          <Link href={`/admin/prompts/${promptId}/edit`} variant="standalone">
            Вернуться в редактор
          </Link>
          {" · "}
          <Link href={`/admin/prompts/${promptId}`} variant="subtle">
            Карточка промта
          </Link>
        </p>
      </Stack>
    </Container>
  );
}
