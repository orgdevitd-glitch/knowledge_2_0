import type { Prompt } from "@/domain/content/prompt";
import type { SourceType } from "@/domain/content/source";
import type { ContentStatus } from "@/domain/shared/status";
import type {
  ContentListFilter,
  Page,
  PaginationInput,
  SaveOptions,
} from "./types";

export type PromptAdminSort =
  | "updatedAt_desc"
  | "title_asc"
  | "createdAt_desc";

/**
 * Admin list filter. Firestore-backed modes are documented in ADR 0010.
 * At most one of categoryId | tagId | audienceId may be set.
 */
export type PromptAdminListFilter = {
  status?: ContentStatus;
  sourceType?: SourceType;
  categoryId?: string;
  tagId?: string;
  audienceId?: string;
  /** Normalized title/slug prefix (bounded scan when used). */
  q?: string;
  sort?: PromptAdminSort;
};

export type PromptAdminPage = Page<Prompt> & {
  /** True when a bounded scan hit its ceiling; results may be incomplete. */
  scanLimitExceeded: boolean;
};

export interface PromptRepository {
  getById(id: string): Promise<Prompt | null>;
  getBySlug(slug: string): Promise<Prompt | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(prompt: Prompt, options: SaveOptions): Promise<Prompt>;
  list(
    filter?: ContentListFilter,
    pagination?: PaginationInput,
  ): Promise<Page<Prompt>>;

  /**
   * Cursor-paginated admin list with deterministic ordering and tie-break by id.
   */
  listAdmin(
    filter?: PromptAdminListFilter,
    pagination?: PaginationInput,
  ): Promise<PromptAdminPage>;

  /**
   * Source-scoped external id lookup (connection namespace + externalId).
   */
  findBySourceExternalId(input: {
    sourceType: SourceType;
    connectionId: string;
    externalId: string;
  }): Promise<Prompt | null>;
}
