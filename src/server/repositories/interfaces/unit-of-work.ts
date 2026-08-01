/**
 * Future Firestore (and other) adapters must provide logical atomicity for publish:
 * save version + update entity + write audit in one transaction when possible.
 * Phase 3 in-memory UoW runs steps sequentially in-process only.
 */
import type { Article } from "@/domain/content/article";
import type { AuditEvent } from "@/domain/content/audit";
import type { Prompt } from "@/domain/content/prompt";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import type { ContentVersion } from "@/domain/content/versioning";

export type AtomicArticlePublishBundle = {
  article: Article;
  expectedRevision: number;
  version: ContentVersion;
  audit: AuditEvent;
};

export type AtomicPromptPublishBundle = {
  prompt: Prompt;
  expectedRevision: number;
  version: ContentVersion;
  audit: AuditEvent;
};

/** Prompt entity write + audit (+ optional immutable version). */
export type AtomicPromptMutationBundle = {
  prompt: Prompt;
  expectedRevision: number;
  audit: AuditEvent;
  version?: ContentVersion;
};

export type TaxonomyMutationKind = "category" | "tag" | "audience";

export type AtomicTaxonomyEntityWrite = {
  kind: TaxonomyMutationKind;
  entity: Category | Tag | Audience;
  expectedRevision: number;
};

/**
 * One or more taxonomy document writes + a single audit event.
 * All-or-nothing when the adapter supports transactions.
 */
export type AtomicTaxonomyMutationBundle = {
  writes: AtomicTaxonomyEntityWrite[];
  audit: AuditEvent;
};

export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
  /**
   * Optional Firestore-backed atomic publish.
   * When present, publishArticle prefers this over sequential run().
   */
  runAtomicArticlePublish?(bundle: AtomicArticlePublishBundle): Promise<void>;
  /**
   * Optional Firestore-backed atomic prompt publish.
   */
  runAtomicPromptPublish?(bundle: AtomicPromptPublishBundle): Promise<void>;
  /**
   * Atomic prompt mutation (entity + audit, optional new ContentVersion).
   */
  runAtomicPromptMutation?(bundle: AtomicPromptMutationBundle): Promise<void>;
  /**
   * Optional atomic taxonomy mutation (entity write(s) + audit).
   */
  runAtomicTaxonomyMutation?(
    bundle: AtomicTaxonomyMutationBundle,
  ): Promise<void>;
}

export class InProcessUnitOfWork implements UnitOfWork {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
