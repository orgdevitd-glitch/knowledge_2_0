import "server-only";

import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { getPublicContentSource } from "@/server/composition/public-content";

export type TaxonomyOption = {
  id: string;
  title: string;
  status: "active" | "archived";
  slug?: string;
};

export type SearchTaxonomyMaps = {
  /** Active-only options for selects / suggestions. */
  selectable: {
    categories: TaxonomyOption[];
    tags: TaxonomyOption[];
    audiences: TaxonomyOption[];
  };
  /** Lookup for display (may include archived used in published content). */
  display: {
    categories: Map<string, TaxonomyOption>;
    tags: Map<string, TaxonomyOption>;
    audiences: Map<string, TaxonomyOption>;
  };
  guidedCategories: TaxonomyOption[];
};

/**
 * Load taxonomy maps once per search page request.
 * Selectable = active only. Display includes archived for title resolution.
 */
export async function loadSearchTaxonomyMaps(): Promise<SearchTaxonomyMaps> {
  const catalog = await getPublicContentSource().loadCatalog();

  const allCategories = catalog.categories.map((c) => ({
    id: c.id as string,
    title: c.title as string,
    status: c.status as "active" | "archived",
    slug: c.slug as string,
  }));
  const allTags = catalog.tags.map((t) => ({
    id: t.id as string,
    title: t.title as string,
    status: t.status as "active" | "archived",
    slug: t.slug as string,
  }));
  const allAudiences = catalog.audiences.map((a) => ({
    id: a.id as string,
    title: a.title as string,
    status: a.status as "active" | "archived",
    slug: a.slug as string,
  }));

  const byTitle = (a: TaxonomyOption, b: TaxonomyOption) =>
    a.title.localeCompare(b.title, "ru") || a.id.localeCompare(b.id);

  const selectable = {
    categories: allCategories.filter((c) => c.status === "active").sort(byTitle),
    tags: allTags.filter((t) => t.status === "active").sort(byTitle),
    audiences: allAudiences
      .filter((a) => a.status === "active")
      .sort(byTitle),
  };

  const display = {
    categories: new Map(allCategories.map((c) => [c.id, c])),
    tags: new Map(allTags.map((t) => [t.id, t])),
    audiences: new Map(allAudiences.map((a) => [a.id, a])),
  };

  return {
    selectable,
    display,
    guidedCategories: selectable.categories.slice(
      0,
      SEARCH_LIMIT_DEFAULTS.guidedCategoryLinks,
    ),
  };
}

export function resolveTaxonomyTitle(
  map: Map<string, TaxonomyOption>,
  id: string | null | undefined,
): { title: string; known: boolean; archived: boolean } {
  if (!id) return { title: "", known: false, archived: false };
  const hit = map.get(id);
  if (!hit) return { title: id, known: false, archived: false };
  return {
    title: hit.title,
    known: true,
    archived: hit.status === "archived",
  };
}
