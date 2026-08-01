import type { AuditEvent } from "@/domain/content/audit";
import type { ContentVersion } from "@/domain/content/versioning";
import type {
  AtomicPromptMutationBundle,
  AtomicPromptPublishBundle,
  UnitOfWork,
} from "@/server/repositories/interfaces/unit-of-work";
import type { MemoryPromptRepository } from "./memory-prompt-repository";
import type { MemoryVersionRepository } from "./memory-version-repository";
import type { MemoryAuditRepository } from "./memory-audit-repository";

/**
 * In-process UoW with rollback semantics for Prompt mutations (tests / memory mode).
 */
export class MemoryPromptUnitOfWork implements UnitOfWork {
  constructor(
    private readonly prompts: MemoryPromptRepository,
    private readonly versions: MemoryVersionRepository,
    private readonly audit: MemoryAuditRepository,
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
}
