/**
 * Public content limits and search weights (Phase 4).
 * Centralized — do not scatter magic numbers across routes.
 */
export const PUBLIC_CONTENT_LIMITS = {
  homeRecentMaterials: 6,
  homePrompts: 4,
  relatedMaterials: 6,
  catalogPageSize: 12,
  searchMaxResults: 25,
  searchMinQueryLength: 2,
  searchMaxQueryLength: 120,
  searchMaxIndexedChars: 20_000,
  tocMaxItems: 40,
} as const;

export const SEARCH_SCORE_WEIGHTS = {
  exactTitle: 100,
  titlePrefix: 70,
  titleToken: 40,
  taxonomyToken: 30,
  summaryToken: 20,
  headingToken: 15,
  bodyToken: 5,
} as const;

export const PUBLIC_SORTS = [
  "updated-desc",
  "published-desc",
  "title-asc",
] as const;

export type PublicSort = (typeof PUBLIC_SORTS)[number];

export const PUBLIC_MATERIAL_TYPES = ["article", "prompt"] as const;

export type PublicMaterialType = (typeof PUBLIC_MATERIAL_TYPES)[number];
