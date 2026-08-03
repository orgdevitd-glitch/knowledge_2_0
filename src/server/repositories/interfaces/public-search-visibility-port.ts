export type PublicSearchVisibilityCandidate = {
  entityType: "article" | "prompt";
  entityId: string;
  versionId: string;
};

export type PublicSearchVisibilityResult = {
  entityType: "article" | "prompt";
  entityId: string;
  visible: boolean;
};

/**
 * Batch live visibility gate — index is candidate source only.
 */
export interface PublicSearchVisibilityPort {
  filterVisible(
    candidates: readonly PublicSearchVisibilityCandidate[],
  ): Promise<PublicSearchVisibilityResult[]>;
}
