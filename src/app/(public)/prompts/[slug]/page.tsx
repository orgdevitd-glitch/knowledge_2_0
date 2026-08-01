import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { MetadataList, Status } from "@/components/ui";
import { Link } from "@/components/ui/Link";
import { getPublishedPromptBySlug } from "@/features/public-content/queries";
import { PromptCopyButton } from "@/features/public-content/rendering/prompt-copy-button";
import {
  reviewStatusLabel,
  reviewStatusTone,
} from "@/features/public-content/review-status";
import { formatDate } from "@/features/public-content/ui/catalog";
import { getSiteUrl } from "@/config/env";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const prompt = await getPublishedPromptBySlug(slug);
  if (!prompt) {
    return { title: "Материал не найден", robots: { index: false } };
  }
  const siteUrl = getSiteUrl();
  return {
    title: prompt.title,
    description: prompt.summary ?? undefined,
    alternates: siteUrl
      ? { canonical: `${siteUrl}/prompts/${prompt.slug}` }
      : undefined,
    openGraph: {
      title: prompt.title,
      description: prompt.summary ?? undefined,
      type: "article",
    },
  };
}

export default async function PromptPage({ params }: { params: Params }) {
  const { slug } = await params;
  const prompt = await getPublishedPromptBySlug(slug);
  if (!prompt) {
    notFound();
  }

  const metadataItems = [
    { id: "type", label: "Тип", value: prompt.metadata.typeLabel },
    {
      id: "updated",
      label: "Обновлено",
      value: formatDate(prompt.updatedAt),
    },
    ...prompt.metadata.categories.map((c) => ({
      id: `cat-${c.id}`,
      label: "Категория",
      value: c.title,
    })),
    ...prompt.metadata.audiences.map((a) => ({
      id: `aud-${a.id}`,
      label: "Аудитория",
      value: a.title,
    })),
  ];

  return (
    <Container width="standard">
      <Stack gap={5}>
        <Breadcrumbs
          items={[
            { id: "home", label: "Главная", href: "/" },
            { id: "prompts", label: "Промты", href: "/prompts" },
            { id: "current", label: prompt.title },
          ]}
        />
        <header>
          <Status
            tone={reviewStatusTone(prompt.reviewStatus)}
            label={reviewStatusLabel(prompt.reviewStatus)}
          />
          <h1 style={{ margin: "0.75rem 0 0.5rem" }}>{prompt.title}</h1>
          {prompt.summary ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              {prompt.summary}
            </p>
          ) : null}
          <div style={{ marginTop: "1rem" }}>
            <MetadataList items={metadataItems} />
          </div>
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

        {prompt.relatedMaterials.length > 0 ? (
          <aside aria-label="Связанные материалы">
            <h2>Связанные материалы</h2>
            <ul>
              {prompt.relatedMaterials.map((item) => (
                <li key={item.id}>
                  <Link href={item.url}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </Stack>
    </Container>
  );
}
