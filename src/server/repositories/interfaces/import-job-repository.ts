import type { ImportJob } from "@/domain/integrations/import-job";

export interface ImportJobRepository {
  getById(id: string): Promise<ImportJob | null>;
  save(job: ImportJob): Promise<ImportJob>;
  listRecent(limit?: number): Promise<ImportJob[]>;
}
