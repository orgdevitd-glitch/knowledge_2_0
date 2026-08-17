import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { getPublishedPromptBySlug } from "@/features/public-content/queries";
import { PromptPublicView } from "@/features/public-content/ui/prompt-public-view";
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

  return (
    <Container width="standard">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "home", label: "Главная", href: "/" },
            { id: "prompts", label: "Промты", href: "/prompts" },
            { id: "current", label: prompt.title },
          ]}
        />
        <PromptPublicView prompt={prompt} />
      </Stack>
    </Container>
  );
}
