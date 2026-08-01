import type { Article } from "@/domain/content/article";
import type { ArticleRepository } from "../interfaces/article-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "../interfaces/types";
import { MemoryEntityStore, MEMORY_REPOSITORY_MARKER } from "./memory-store";

export class MemoryArticleRepository implements ArticleRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly store = new MemoryEntityStore<Article>();

  getById(id: string) {
    return Promise.resolve(this.store.getById(id));
  }

  getBySlug(slug: string) {
    return Promise.resolve(this.store.getBySlug(slug));
  }

  existsBySlug(slug: string, excludeId?: string) {
    return Promise.resolve(this.store.existsBySlug(slug, excludeId));
  }

  save(article: Article, options: SaveOptions) {
    return Promise.resolve(this.store.save(article, options));
  }

  list(filter?: ContentListFilter, pagination?: PaginationInput) {
    return Promise.resolve(this.store.list(filter, pagination));
  }

  clear() {
    this.store.clear();
  }
}
