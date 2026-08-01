import type { SourceConnection } from "@/domain/integrations/source-connection";

export interface SourceConnectionRepository {
  getById(id: string): Promise<SourceConnection | null>;
  getByExternalId(externalId: string): Promise<SourceConnection | null>;
  save(
    connection: SourceConnection,
    expectedRevision: number,
  ): Promise<SourceConnection>;
  listActive(limit?: number): Promise<SourceConnection[]>;
  listRecent?(limit?: number): Promise<SourceConnection[]>;
}
