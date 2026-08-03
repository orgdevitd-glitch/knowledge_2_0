import type {
  SearchIndexFailure,
  SearchIndexFailureRepository,
} from "../interfaces/search-index-failure-repository";
import { MEMORY_REPOSITORY_MARKER } from "./memory-store";

export class MemorySearchIndexFailureRepository
  implements SearchIndexFailureRepository
{
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly items = new Map<string, SearchIndexFailure>();
  failNextSave: Error | null = null;

  async getById(id: string): Promise<SearchIndexFailure | null> {
    return this.items.get(id) ?? null;
  }

  async save(failure: SearchIndexFailure): Promise<void> {
    if (this.failNextSave) {
      const err = this.failNextSave;
      this.failNextSave = null;
      throw err;
    }
    this.items.set(failure.id, failure);
  }

  async listUnresolved(limit: number): Promise<SearchIndexFailure[]> {
    return [...this.items.values()]
      .filter((f) => f.resolvedAt == null)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);
  }

  async findOpenForEntity(
    entityType: "article" | "prompt",
    entityId: string,
  ): Promise<SearchIndexFailure | null> {
    const open = await this.listOpenForEntity(entityType, entityId);
    return open[0] ?? null;
  }

  async listOpenForEntity(
    entityType: "article" | "prompt",
    entityId: string,
  ): Promise<SearchIndexFailure[]> {
    const open = [...this.items.values()].filter(
      (f) =>
        f.resolvedAt == null &&
        f.entityType === entityType &&
        f.entityId === entityId,
    );
    open.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return open;
  }

  clear(): void {
    this.items.clear();
    this.failNextSave = null;
  }
}
