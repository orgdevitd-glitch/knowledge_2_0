import "server-only";

import type {
  PublicContentCatalog,
  PublicContentSource,
} from "./public-content-source";

/** Production default before Firestore: no published materials. */
export class EmptyPublicContentSource implements PublicContentSource {
  readonly mode = "empty" as const;

  async loadCatalog(): Promise<PublicContentCatalog> {
    return {
      articles: [],
      prompts: [],
      categories: [],
      tags: [],
      audiences: [],
    };
  }
}
