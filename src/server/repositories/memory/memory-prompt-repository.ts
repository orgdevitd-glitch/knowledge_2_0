import type { Prompt } from "@/domain/content/prompt";
import type { PromptRepository } from "../interfaces/prompt-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "../interfaces/types";
import { MemoryEntityStore, MEMORY_REPOSITORY_MARKER } from "./memory-store";

export class MemoryPromptRepository implements PromptRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly store = new MemoryEntityStore<Prompt>();

  getById(id: string) {
    return Promise.resolve(this.store.getById(id));
  }

  getBySlug(slug: string) {
    return Promise.resolve(this.store.getBySlug(slug));
  }

  existsBySlug(slug: string, excludeId?: string) {
    return Promise.resolve(this.store.existsBySlug(slug, excludeId));
  }

  save(prompt: Prompt, options: SaveOptions) {
    return Promise.resolve(this.store.save(prompt, options));
  }

  list(filter?: ContentListFilter, pagination?: PaginationInput) {
    return Promise.resolve(this.store.list(filter, pagination));
  }

  clear() {
    this.store.clear();
  }
}
