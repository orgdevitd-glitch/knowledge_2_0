import type { MediaAsset } from "@/domain/content/media";
import type { MediaKind, MediaStatus } from "@/domain/content/media";
import type { Page, PaginationInput, SaveOptions } from "./types";

export type MediaAdminSort = "updatedAt_desc";

/**
 * Admin list filter for media assets.
 */
export type MediaAdminListFilter = {
  status?: MediaStatus;
  kind?: MediaKind;
  /** Normalized title / file name search (bounded scan when used). */
  q?: string;
  sort?: MediaAdminSort;
};

export type MediaAdminPage = Page<MediaAsset> & {
  /** True when a bounded scan hit its ceiling; results may be incomplete. */
  scanLimitExceeded: boolean;
};

export interface MediaRepository {
  getById(id: string): Promise<MediaAsset | null>;
  save(media: MediaAsset, options: SaveOptions): Promise<MediaAsset>;
  /**
   * Cursor-paginated admin list with deterministic ordering and tie-break by id.
   */
  listAdmin(
    filter?: MediaAdminListFilter,
    pagination?: PaginationInput,
  ): Promise<MediaAdminPage>;

  /** TEST_ONLY rollback helper */
  replaceUnchecked(media: MediaAsset | null, id: string): void;
}
