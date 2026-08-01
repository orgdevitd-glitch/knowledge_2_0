import type { Video } from "@/domain/content/video";
import type { VideoRepository } from "../interfaces/video-repository";
import type {
  ContentListFilter,
  PaginationInput,
  SaveOptions,
} from "../interfaces/types";
import { MemoryEntityStore, MEMORY_REPOSITORY_MARKER } from "./memory-store";

export class MemoryVideoRepository implements VideoRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly store = new MemoryEntityStore<Video>();

  getById(id: string) {
    return Promise.resolve(this.store.getById(id));
  }

  getBySlug(slug: string) {
    return Promise.resolve(this.store.getBySlug(slug));
  }

  existsBySlug(slug: string, excludeId?: string) {
    return Promise.resolve(this.store.existsBySlug(slug, excludeId));
  }

  save(video: Video, options: SaveOptions) {
    return Promise.resolve(this.store.save(video, options));
  }

  list(filter?: ContentListFilter, pagination?: PaginationInput) {
    return Promise.resolve(this.store.list(filter, pagination));
  }

  clear() {
    this.store.clear();
  }
}
