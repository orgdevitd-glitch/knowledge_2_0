import type { ArticleSnapshot } from "@/domain/content/article";
import type { PromptSnapshot } from "@/domain/content/prompt";
import type {
  AssistantEntityType,
  AssistantEvidenceReference,
} from "@/domain/assistant/types";

export type AssistantHydratedPublishedContent =
  | {
      status: "ok";
      entityType: "article";
      entityId: string;
      versionId: string;
      title: string;
      slug: string;
      href: string;
      publishedAt: string | null;
      snapshot: ArticleSnapshot;
    }
  | {
      status: "ok";
      entityType: "prompt";
      entityId: string;
      versionId: string;
      title: string;
      slug: string;
      href: string;
      publishedAt: string | null;
      snapshot: PromptSnapshot;
    }
  | {
      status: "missing" | "stale" | "not_published" | "error";
      entityType: AssistantEntityType;
      entityId: string;
      versionId: string;
    };

/**
 * Batch-oriented published snapshot hydration for the assistant.
 * Fail-closed on repository errors.
 */
export interface PublicAssistantContentPort {
  loadPublishedSnapshots(
    references: readonly AssistantEvidenceReference[],
  ): Promise<AssistantHydratedPublishedContent[]>;
}
