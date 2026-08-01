import type { AuditEvent } from "@/domain/content/audit";
import type { ContentVersion } from "@/domain/content/versioning";
import { RepositoryError } from "@/domain/shared/errors";
import type {
  AtomicMediaMutationBundle,
  AtomicPromptMutationBundle,
  AtomicPromptPublishBundle,
  UnitOfWork,
} from "@/server/repositories/interfaces/unit-of-work";
import type { MemoryPromptRepository } from "./memory-prompt-repository";
import type { MemoryMediaRepository } from "./memory-media-repository";
import type { MemoryVersionRepository } from "./memory-version-repository";
import type { MemoryAuditRepository } from "./memory-audit-repository";

/**
 * In-process UoW with rollback semantics for Prompt and Media mutations (tests / memory mode).
 */
export class MemoryPromptUnitOfWork implements UnitOfWork {
  constructor(
    private readonly prompts: MemoryPromptRepository,
    private readonly versions: MemoryVersionRepository,
    private readonly audit: MemoryAuditRepository,
    private readonly media?: MemoryMediaRepository,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }

  async runAtomicPromptPublish(
    bundle: AtomicPromptPublishBundle,
  ): Promise<void> {
    await this.runAtomicPromptMutation({
      prompt: bundle.prompt,
      expectedRevision: bundle.expectedRevision,
      audit: bundle.audit,
      version: bundle.version,
    });
  }

  async runAtomicPromptMutation(
    bundle: AtomicPromptMutationBundle,
  ): Promise<void> {
    const prev = await this.prompts.getById(bundle.prompt.id);
    const wroteVersion = Boolean(bundle.version);
    let versionWritten: ContentVersion | null = null;
    let auditWritten: AuditEvent | null = null;

    try {
      await this.prompts.save(bundle.prompt, {
        expectedRevision: bundle.expectedRevision,
      });
      if (bundle.version) {
        versionWritten = await this.versions.saveImmutable(bundle.version);
      }
      await this.audit.append(bundle.audit);
      auditWritten = bundle.audit;
    } catch (error) {
      this.prompts.replaceUnchecked(prev, bundle.prompt.id);
      if (wroteVersion && versionWritten) {
        this.versions.removeUnchecked(versionWritten.id);
      }
      if (auditWritten) {
        this.audit.removeUnchecked(auditWritten.id);
      }
      throw error;
    }
  }

  async runAtomicMediaMutation(
    bundle: AtomicMediaMutationBundle,
  ): Promise<void> {
    if (!this.media) {
      throw new RepositoryError(
        "Media repository is not configured for atomic media mutation",
      );
    }
    if (!bundle.audits.length) {
      throw new RepositoryError(
        "Atomic media mutation requires at least one audit",
      );
    }

    const prev = await this.media.getById(bundle.media.id);
    const auditsWritten: AuditEvent[] = [];

    try {
      await this.media.save(bundle.media, {
        expectedRevision: bundle.expectedRevision,
      });
      for (const audit of bundle.audits) {
        await this.audit.append(audit);
        auditsWritten.push(audit);
      }
    } catch (error) {
      this.media.replaceUnchecked(prev, bundle.media.id);
      for (const audit of auditsWritten) {
        this.audit.removeUnchecked(audit.id);
      }
      throw error;
    }
  }
}
