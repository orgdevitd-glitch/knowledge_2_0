import type { Prompt } from "@/domain/content/prompt";
import type {
  ContentListFilter,
  Page,
  PaginationInput,
  SaveOptions,
} from "./types";

export interface PromptRepository {
  getById(id: string): Promise<Prompt | null>;
  getBySlug(slug: string): Promise<Prompt | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(prompt: Prompt, options: SaveOptions): Promise<Prompt>;
  list(
    filter?: ContentListFilter,
    pagination?: PaginationInput,
  ): Promise<Page<Prompt>>;
}
