import type { Article } from "@/domain/content/article";
import type {
  ContentListFilter,
  Page,
  PaginationInput,
  SaveOptions,
} from "./types";

export interface ArticleRepository {
  getById(id: string): Promise<Article | null>;
  getBySlug(slug: string): Promise<Article | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(article: Article, options: SaveOptions): Promise<Article>;
  list(
    filter?: ContentListFilter,
    pagination?: PaginationInput,
  ): Promise<Page<Article>>;
}
