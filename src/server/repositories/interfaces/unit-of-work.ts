/**
 * Future Firestore (and other) adapters must provide logical atomicity for publish:
 * save version + update entity + write audit in one transaction when possible.
 * Phase 3 in-memory UoW runs steps sequentially in-process only.
 */
import type { Article } from "@/domain/content/article";
import type { AuditEvent } from "@/domain/content/audit";
import type { ContentVersion } from "@/domain/content/versioning";

export type AtomicArticlePublishBundle = {
  article: Article;
  expectedRevision: number;
  version: ContentVersion;
  audit: AuditEvent;
};

export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
  /**
   * Optional Firestore-backed atomic publish.
   * When present, publishArticle prefers this over sequential run().
   */
  runAtomicArticlePublish?(bundle: AtomicArticlePublishBundle): Promise<void>;
}

export class InProcessUnitOfWork implements UnitOfWork {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
