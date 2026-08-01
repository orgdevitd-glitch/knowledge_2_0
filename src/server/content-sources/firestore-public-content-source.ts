import "server-only";

import type { Article, ArticleSnapshot } from "@/domain/content/article";
import { articleFromPublishedSnapshot } from "@/domain/content/article";
import type { Prompt } from "@/domain/content/prompt";
import type { PublicContentCatalog } from "@/server/content-sources/public-content-source";
import type { PublicContentSource } from "@/server/content-sources/public-content-source";
import { FirestoreArticleRepository } from "@/server/repositories/firestore/firestore-article-repository";
import {
  FirestoreAudienceRepository,
  FirestoreCategoryRepository,
  FirestoreTagRepository,
} from "@/server/repositories/firestore/firestore-taxonomy-repository";
import { FirestoreVersionRepository } from "@/server/repositories/firestore/firestore-version-repository";
import { FirestorePromptRepository } from "@/server/repositories/firestore/firestore-prompt-repository";
import { logger } from "@/lib/logger";
import { CONTENT_LIMITS } from "@/domain/shared/limits";

/**
 * Server-only public read source backed by Firestore.
 * Articles are hydrated from ContentVersion snapshots (publishedVersion),
 * not from the live working copy on articles/{id}.
 */
export class FirestorePublicContentSource implements PublicContentSource {
  readonly mode = "firestore" as const;

  async loadCatalog(): Promise<PublicContentCatalog> {
    const articlesRepo = new FirestoreArticleRepository();
    const versionsRepo = new FirestoreVersionRepository();
    const promptsRepo = new FirestorePromptRepository();
    const categoriesRepo = new FirestoreCategoryRepository();
    const tagsRepo = new FirestoreTagRepository();
    const audiencesRepo = new FirestoreAudienceRepository();

    const [articlePage, promptPage, categories, tags, audiences] =
      await Promise.all([
        articlesRepo.list(
          { status: "published", sort: "updatedAt_desc" },
          { limit: CONTENT_LIMITS.listMaxLimit },
        ),
        promptsRepo.list(
          { status: "published", sort: "updatedAt_desc" },
          { limit: CONTENT_LIMITS.listMaxLimit },
        ),
        categoriesRepo.listAll(),
        tagsRepo.listAll(),
        audiencesRepo.listAll(),
      ]);

    const articles: Article[] = [];
    for (const live of articlePage.items) {
      try {
        if (live.status !== "published" || !live.publishedVersion) continue;
        const version = await versionsRepo.getById(String(live.publishedVersion));
        if (!version || version.entityType !== "article") {
          logger.warn("content integrity: missing published version", {
            articleId: String(live.id),
          });
          continue;
        }
        const snapshot = version.snapshot as unknown as ArticleSnapshot;
        articles.push(articleFromPublishedSnapshot(live, snapshot));
      } catch (error) {
        logger.warn("content integrity: skipped damaged public article", {
          cause: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    const prompts: Prompt[] = [];
    for (const prompt of promptPage.items) {
      try {
        if (prompt.status !== "published") continue;
        prompts.push(prompt);
      } catch (error) {
        logger.warn("content integrity: skipped damaged public prompt", {
          cause: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return {
      articles,
      prompts,
      categories,
      tags,
      audiences,
    };
  }
}
