import "server-only";

import type { Article } from "@/domain/content/article";
import type { Prompt } from "@/domain/content/prompt";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";

/**
 * Storage-agnostic public content catalog snapshot.
 * Adapters (empty, demo, future Firestore) implement this shape.
 */
export type PublicContentCatalog = {
  articles: Article[];
  prompts: Prompt[];
  categories: Category[];
  tags: Tag[];
  audiences: Audience[];
};

export interface PublicContentSource {
  readonly mode: "empty" | "demo" | "firestore";
  loadCatalog(): Promise<PublicContentCatalog>;
}
