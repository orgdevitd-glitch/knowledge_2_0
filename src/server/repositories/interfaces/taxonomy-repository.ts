import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import type { Page, PaginationInput, SaveOptions } from "./types";

export interface CategoryRepository {
  getById(id: string): Promise<Category | null>;
  getBySlug(slug: string): Promise<Category | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(category: Category, options: SaveOptions): Promise<Category>;
  list(pagination?: PaginationInput): Promise<Page<Category>>;
  listAll(): Promise<Category[]>;
}

export interface TagRepository {
  getById(id: string): Promise<Tag | null>;
  getBySlug(slug: string): Promise<Tag | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(tag: Tag, options: SaveOptions): Promise<Tag>;
  list(pagination?: PaginationInput): Promise<Page<Tag>>;
  listAll(): Promise<Tag[]>;
}

export interface AudienceRepository {
  getById(id: string): Promise<Audience | null>;
  getBySlug(slug: string): Promise<Audience | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  save(audience: Audience, options: SaveOptions): Promise<Audience>;
  list(pagination?: PaginationInput): Promise<Page<Audience>>;
  listAll(): Promise<Audience[]>;
}
