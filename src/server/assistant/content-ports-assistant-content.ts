import "server-only";

import type { ArticleSnapshot } from "@/domain/content/article";
import type { PromptSnapshot } from "@/domain/content/prompt";
import type { ContentPorts } from "@/features/content/application/ports";
import { isSafePublicSearchHref } from "@/domain/search/search-href";
import type {
  AssistantEvidenceReference,
  AssistantEntityType,
} from "@/domain/assistant/types";
import type {
  AssistantHydratedPublishedContent,
  PublicAssistantContentPort,
} from "@/server/repositories/interfaces/assistant-content-port";
import { getAssistantConfig } from "@/config/assistant-env";

function asArticleSnapshot(raw: unknown): ArticleSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ArticleSnapshot;
  if (typeof s.slug !== "string" || typeof s.title !== "string") return null;
  if (!Array.isArray(s.blocks)) return null;
  return s;
}

function asPromptSnapshot(raw: unknown): PromptSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as PromptSnapshot;
  if (
    typeof s.slug !== "string" ||
    typeof s.title !== "string" ||
    typeof s.promptText !== "string"
  ) {
    return null;
  }
  return s;
}

export class ContentPortsAssistantContentAdapter
  implements PublicAssistantContentPort
{
  constructor(private readonly ports: ContentPorts) {}

  async loadPublishedSnapshots(
    references: readonly AssistantEvidenceReference[],
  ): Promise<AssistantHydratedPublishedContent[]> {
    const batchSize = getAssistantConfig().hydrationBatchSize;
    const out: AssistantHydratedPublishedContent[] = [];

    for (let i = 0; i < references.length; i += batchSize) {
      const batch = references.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((ref) => this.loadOne(ref)),
      );
      out.push(...batchResults);
    }
    return out;
  }

  private async loadOne(
    ref: AssistantEvidenceReference,
  ): Promise<AssistantHydratedPublishedContent> {
    try {
      if (ref.entityType === "article") {
        return await this.loadArticle(ref.entityId, ref.versionId);
      }
      return await this.loadPrompt(ref.entityId, ref.versionId);
    } catch {
      return {
        status: "error",
        entityType: ref.entityType,
        entityId: ref.entityId,
        versionId: ref.versionId,
      };
    }
  }

  private async loadArticle(
    entityId: string,
    versionId: string,
  ): Promise<AssistantHydratedPublishedContent> {
    const live = await this.ports.articles.getById(entityId);
    if (!live) {
      return {
        status: "missing",
        entityType: "article",
        entityId,
        versionId,
      };
    }
    if (live.status !== "published" || !live.publishedVersion) {
      return {
        status: "not_published",
        entityType: "article",
        entityId,
        versionId,
      };
    }
    if (String(live.publishedVersion) !== versionId) {
      return {
        status: "stale",
        entityType: "article",
        entityId,
        versionId,
      };
    }
    const version = await this.ports.versions.getById(versionId);
    // Fail-closed: version must belong to this article (no cross-entity reuse).
    if (
      !version ||
      version.entityType !== "article" ||
      String(version.entityId) !== entityId
    ) {
      return {
        status: "missing",
        entityType: "article",
        entityId,
        versionId,
      };
    }
    const snapshot = asArticleSnapshot(version.snapshot);
    if (!snapshot) {
      return {
        status: "missing",
        entityType: "article",
        entityId,
        versionId,
      };
    }
    const href = `/articles/${snapshot.slug}`;
    if (!isSafePublicSearchHref(href)) {
      return {
        status: "error",
        entityType: "article",
        entityId,
        versionId,
      };
    }
    return {
      status: "ok",
      entityType: "article",
      entityId,
      versionId,
      title: snapshot.title,
      slug: snapshot.slug,
      href,
      publishedAt: live.publishedAt,
      snapshot,
    };
  }

  private async loadPrompt(
    entityId: string,
    versionId: string,
  ): Promise<AssistantHydratedPublishedContent> {
    const live = await this.ports.prompts.getById(entityId);
    if (!live) {
      return {
        status: "missing",
        entityType: "prompt",
        entityId,
        versionId,
      };
    }
    if (live.status !== "published" || !live.publishedVersion) {
      return {
        status: "not_published",
        entityType: "prompt",
        entityId,
        versionId,
      };
    }
    if (String(live.publishedVersion) !== versionId) {
      return {
        status: "stale",
        entityType: "prompt",
        entityId,
        versionId,
      };
    }
    const version = await this.ports.versions.getById(versionId);
    // Fail-closed: version must belong to this prompt (no cross-entity reuse).
    if (
      !version ||
      version.entityType !== "prompt" ||
      String(version.entityId) !== entityId
    ) {
      return {
        status: "missing",
        entityType: "prompt",
        entityId,
        versionId,
      };
    }
    const snapshot = asPromptSnapshot(version.snapshot);
    if (!snapshot) {
      return {
        status: "missing",
        entityType: "prompt",
        entityId,
        versionId,
      };
    }
    const href = `/prompts/${snapshot.slug}`;
    if (!isSafePublicSearchHref(href)) {
      return {
        status: "error",
        entityType: "prompt",
        entityId,
        versionId,
      };
    }
    return {
      status: "ok",
      entityType: "prompt",
      entityId,
      versionId,
      title: snapshot.title,
      slug: snapshot.slug,
      href,
      publishedAt: live.publishedAt,
      snapshot,
    };
  }
}

export function assistantEntityKey(
  entityType: AssistantEntityType,
  entityId: string,
): string {
  return `${entityType}:${entityId}`;
}
