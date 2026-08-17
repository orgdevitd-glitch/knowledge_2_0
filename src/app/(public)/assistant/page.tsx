import type { Metadata } from "next";
import { connection } from "next/server";

import { Breadcrumbs, Container, Stack } from "@/components/layout";
import { AssistantUnavailable } from "@/features/assistant/ui/assistant-unavailable";
import { loadSearchTaxonomyMaps } from "@/features/search/application/taxonomy-display";
import { getPublicAssistantCapability } from "@/server/composition/assistant-ui-capability";

export const dynamic = "force-dynamic";

function AssistantChrome({ children }: { children: React.ReactNode }) {
  return (
    <Container width="wide">
      <Stack gap={4}>
        <Breadcrumbs
          items={[
            { id: "home", label: "Главная", href: "/" },
            { id: "assistant", label: "Ассистент" },
          ]}
        />
        {children}
      </Stack>
    </Container>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const capability = getPublicAssistantCapability();
  if (!capability.available) {
    return {
      title: "Ассистент",
      description:
        "Ассистент пока недоступен. Используйте поиск по опубликованным материалам.",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: "Ассистент",
    description:
      "Один вопрос по опубликованным материалам портала знаний. Это не переписка и не чат.",
    robots: { index: false, follow: true },
  };
}

export default async function AssistantPage() {
  await connection();
  const capability = getPublicAssistantCapability();

  if (!capability.available) {
    return (
      <AssistantChrome>
        <AssistantUnavailable />
      </AssistantChrome>
    );
  }

  const maps = await loadSearchTaxonomyMaps();
  const { AssistantExperience } = await import(
    "@/features/assistant/ui/assistant-experience"
  );

  return (
    <AssistantChrome>
      <AssistantExperience
        demonstration={capability.demonstration}
        questionMinLength={capability.questionMinLength}
        questionMaxLength={capability.questionMaxLength}
        categories={maps.selectable.categories.map((c) => ({
          id: c.id,
          title: c.title,
        }))}
        tags={maps.selectable.tags.map((t) => ({
          id: t.id,
          title: t.title,
        }))}
        audiences={maps.selectable.audiences.map((a) => ({
          id: a.id,
          title: a.title,
        }))}
      />
    </AssistantChrome>
  );
}
