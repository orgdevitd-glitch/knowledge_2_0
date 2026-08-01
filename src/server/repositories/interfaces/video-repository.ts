import type { Video } from "@/domain/content/video";
import type {
  ContentListFilter,
  Page,
  PaginationInput,
  SaveOptions,
} from "./types";

export interface VideoRepository {
  getById(id: string): Promise<Video | null>;
  getBySlug(slug: string): Promise<Video | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(video: Video, options: SaveOptions): Promise<Video>;
  list(
    filter?: ContentListFilter,
    pagination?: PaginationInput,
  ): Promise<Page<Video>>;
}
