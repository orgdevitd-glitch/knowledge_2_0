/** TEST_ONLY in-memory ImportJob repository. */
import type { ImportJob } from "@/domain/integrations/import-job";
import type { ImportJobRepository } from "@/server/repositories/interfaces/import-job-repository";

export class MemoryImportJobRepository implements ImportJobRepository {
  private readonly store = new Map<string, ImportJob>();

  async getById(id: string): Promise<ImportJob | null> {
    return this.store.get(id) ?? null;
  }

  async save(job: ImportJob): Promise<ImportJob> {
    this.store.set(job.id, structuredClone(job));
    return job;
  }

  async listRecent(limit = 50): Promise<ImportJob[]> {
    return [...this.store.values()]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit);
  }

  clearForTests(): void {
    this.store.clear();
  }
}
