/** TEST_ONLY in-memory SourceConnection repository. */
import type { SourceConnection } from "@/domain/integrations/source-connection";
import { ConflictError } from "@/domain/shared/errors";
import type { SourceConnectionRepository } from "@/server/repositories/interfaces/source-connection-repository";

export class MemorySourceConnectionRepository
  implements SourceConnectionRepository
{
  private readonly store = new Map<string, SourceConnection>();

  async getById(id: string): Promise<SourceConnection | null> {
    return this.store.get(id) ?? null;
  }

  async getByExternalId(externalId: string): Promise<SourceConnection | null> {
    for (const connection of this.store.values()) {
      if (connection.externalId === externalId) {
        return connection;
      }
    }
    return null;
  }

  async save(
    connection: SourceConnection,
    expectedRevision: number,
  ): Promise<SourceConnection> {
    const existing = this.store.get(connection.id);
    if (!existing) {
      if (expectedRevision !== 0) {
        throw new ConflictError(
          "Cannot create SourceConnection with non-zero expected revision",
        );
      }
    } else if (existing.revision !== expectedRevision) {
      throw new ConflictError("SourceConnection optimistic concurrency conflict", {
        expectedRevision,
        actualRevision: existing.revision,
      });
    }
    this.store.set(connection.id, structuredClone(connection));
    return connection;
  }

  async listActive(limit = 100): Promise<SourceConnection[]> {
    return [...this.store.values()]
      .filter((c) => c.status === "active")
      .slice(0, limit);
  }

  async listRecent(limit = 100): Promise<SourceConnection[]> {
    return [...this.store.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  clearForTests(): void {
    this.store.clear();
  }
}
