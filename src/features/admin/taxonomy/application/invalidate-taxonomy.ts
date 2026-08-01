import "server-only";

import { getPublicContentInvalidation } from "@/server/content/public-invalidation";

/** Taxonomy changes affect catalogs, filters, search labels. */
export function invalidateTaxonomyPublicCaches(): void {
  getPublicContentInvalidation().invalidateCatalogs();
}
