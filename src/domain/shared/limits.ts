/**
 * Centralized content-domain limits.
 * Do not scatter magic numbers across schemas.
 */
export const CONTENT_LIMITS = {
  id: { min: 1, max: 128 },
  slug: { min: 1, max: 96 },
  title: { min: 1, max: 200 },
  summary: { max: 1000 },
  plainText: { max: 50_000 },
  promptText: { min: 1, max: 20_000 },
  code: { max: 50_000 },
  url: { max: 2048 },
  changeSummary: { max: 500 },
  auditMetadataBytes: 4096,
  blocksPerArticle: 200,
  relatedIds: 50,
  taxonomyIds: 40,
  galleryItems: { min: 2, max: 30 },
  listItems: { min: 1, max: 100 },
  tableColumns: { min: 1, max: 20 },
  tableRows: { max: 200 },
  steps: { min: 1, max: 50 },
  checklistItems: { min: 1, max: 100 },
  faqItems: { min: 1, max: 50 },
  relatedContentItems: { min: 1, max: 20 },
  videoChapters: 100,
  categoryTreeDepth: 5,
  /**
   * Max taxonomy entities loaded for admin tree / uniqueness checks.
   * Alias: MAX_TAXONOMY_TREE_ITEMS.
   */
  maxTaxonomyTreeItems: 500,
  /** Max content docs scanned while building taxonomy usage. */
  maxTaxonomyUsageScan: 2_000,
  taxonomyUsagePageDefault: 20,
  taxonomyUsagePageMax: 50,
  listDefaultLimit: 20,
  listMaxLimit: 100,
  /** Max docs scanned for bounded admin text/prefix search. */
  maxPromptAdminScan: 500,
  adminPromptPageDefault: 20,
  adminPromptPageMax: 50,
} as const;

/** Centralized taxonomy tree / catalog load ceiling (Phase 7A). */
export const MAX_TAXONOMY_TREE_ITEMS = CONTENT_LIMITS.maxTaxonomyTreeItems;
