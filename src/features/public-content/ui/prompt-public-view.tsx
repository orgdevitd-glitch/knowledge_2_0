import { Stack } from "@/components/layout";
import { MetadataList, Status } from "@/components/ui";
import { PromptCopyButton } from "@/features/public-content/rendering/prompt-copy-button";
import {
  reviewStatusLabel,
  reviewStatusTone,
} from "@/features/public-content/review-status";
import type { PromptDetail } from "@/features/public-content/read-models";
import { formatDate } from "@/features/public-content/ui/catalog";
import {
  relatedMaterialsList,
  taxonomyMetadataItems,
} from "@/features/public-content/ui/taxonomy-links";

import styles from "./prompt-public-view.module.css";

export function PromptPublicView({ prompt }: { prompt: PromptDetail }) {
  const statusLabel = reviewStatusLabel(prompt.reviewStatus);
  const statusTone = reviewStatusTone(prompt.reviewStatus);
  const metadataItems = taxonomyMetadataItems({
    typeLabel: prompt.metadata.typeLabel,
    updatedLabel: formatDate(prompt.updatedAt),
    categories: prompt.metadata.categories,
    audiences: prompt.metadata.audiences,
    tags: prompt.metadata.tags,
  });

  return (
    <Stack gap={5}>
      <header>
        {statusLabel && statusTone ? (
          <Status tone={statusTone} label={statusLabel} />
        ) : null}
        <h1 className={styles.title}>{prompt.title}</h1>
        {prompt.summary ? <p className={styles.summary}>{prompt.summary}</p> : null}
        <div className={styles.meta}>
          <MetadataList items={metadataItems} />
        </div>
      </header>

      <section aria-labelledby="prompt-text">
        <h2 id="prompt-text">Текст промта</h2>
        <pre className={styles.promptText}>{prompt.promptText}</pre>
        <PromptCopyButton text={prompt.promptText} />
      </section>

      {prompt.inputRequirements ? (
        <section>
          <h2>Входные данные</h2>
          <p className={styles.sectionBody}>{prompt.inputRequirements}</p>
        </section>
      ) : null}
      {prompt.outputRequirements ? (
        <section>
          <h2>Ожидаемый результат</h2>
          <p className={styles.sectionBody}>{prompt.outputRequirements}</p>
        </section>
      ) : null}
      {prompt.restrictions ? (
        <section>
          <h2>Ограничения</h2>
          <p className={styles.sectionBody}>{prompt.restrictions}</p>
        </section>
      ) : null}
      {prompt.usageExample ? (
        <section>
          <h2>Пример использования</h2>
          <p className={styles.sectionBody}>{prompt.usageExample}</p>
        </section>
      ) : null}

      {prompt.relatedMaterials.length > 0 ? (
        <aside aria-label="Связанные материалы">
          <h2>Связанные материалы</h2>
          {relatedMaterialsList(prompt.relatedMaterials)}
        </aside>
      ) : null}
    </Stack>
  );
}
