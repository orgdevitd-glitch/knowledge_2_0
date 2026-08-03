import "server-only";

import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import {
  normalizeSearchQuery,
  normalizeSearchText,
} from "@/domain/search/text-normalize";
import { isActiveSearchDocument } from "@/domain/search/search-document";
import { isSafePublicSearchHref } from "@/domain/search/search-href";
import { RepositoryError } from "@/domain/shared/errors";
import {
  getPublicSearchVisibility,
  getSearchIndex,
} from "@/server/composition/search-ports";
import { loadSearchTaxonomyMaps } from "@/features/search/application/taxonomy-display";

export type SearchSuggestionKind = "title" | "category" | "tag" | "audience";

export type SearchSuggestionItem = {
  kind: SearchSuggestionKind;
  label: string;
  entityType: "article" | "prompt" | null;
  href: string | null;
  filterKey: "category" | "tag" | "audience" | null;
  filterId: string | null;
};

export type SearchSuggestionsResult = {
  status: "ok" | "empty" | "unavailable";
  items: SearchSuggestionItem[];
  incomplete: boolean;
};

function startsWithNormalized(haystack: string, prefix: string): boolean {
  return normalizeSearchQuery(haystack).startsWith(prefix);
}

/**
 * Lightweight suggestions from current index titles + active public taxonomy.
 * Does not mutate Search Foundation contracts.
 */
export async function executeSearchSuggestions(input: {
  q: string;
  type?: string | null;
  category?: string | null;
  tag?: string | null;
  audience?: string | null;
  limit?: number | null;
}): Promise<SearchSuggestionsResult> {
  const raw = input.q ?? "";
  const prefix = normalizeSearchQuery(raw);
  if (prefix.length < SEARCH_LIMIT_DEFAULTS.suggestionsMinPrefix) {
    return { status: "empty", items: [], incomplete: false };
  }

  const limit = Math.min(
    Math.max(input.limit ?? SEARCH_LIMIT_DEFAULTS.suggestionsMaxItems, 1),
    SEARCH_LIMIT_DEFAULTS.suggestionsMaxItems,
  );

  const entityTypeFilter =
    input.type === "article" || input.type === "prompt" ? input.type : null;

  let incomplete = false;
  const titleItems: SearchSuggestionItem[] = [];

  try {
    const index = getSearchIndex();
    const manifest = await index.getCurrentGeneration();
    if (!manifest) {
      // Still allow taxonomy suggestions.
    } else {
      const generation = await index.loadGeneration(manifest.generationId);
      if (!generation) {
        incomplete = true;
      } else {
        const active = generation.activeDocuments.filter((d) => {
          if (entityTypeFilter && d.entityType !== entityTypeFilter) return false;
          if (input.category && !d.categoryIds.includes(input.category)) {
            return false;
          }
          if (input.tag && !d.tagIds.includes(input.tag)) return false;
          if (input.audience && !d.audienceIds.includes(input.audience)) {
            return false;
          }
          return startsWithNormalized(d.title, prefix);
        });

        // Deterministic: exact title match first, then prefix, then label/id.
        active.sort((a, b) => {
          const aExact =
            normalizeSearchQuery(a.title) === prefix ? 0 : 1;
          const bExact =
            normalizeSearchQuery(b.title) === prefix ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
          const byTitle = a.title.localeCompare(b.title, "ru");
          if (byTitle !== 0) return byTitle;
          return a.entityId.localeCompare(b.entityId);
        });

        const scanCap = Math.min(
          active.length,
          SEARCH_LIMIT_DEFAULTS.suggestionsTitleScanLimit,
        );
        if (active.length > scanCap) incomplete = true;
        const scanned = active.slice(0, scanCap);

        const visibility = getPublicSearchVisibility();
        const gate = await visibility.filterVisible(
          scanned.map((d) => ({
            entityType: d.entityType,
            entityId: d.entityId,
            versionId: d.versionId,
          })),
        );
        const visible = new Set(
          gate.filter((g) => g.visible).map((g) => `${g.entityType}:${g.entityId}`),
        );

        for (const doc of scanned) {
          if (!isActiveSearchDocument(doc)) continue;
          if (!visible.has(`${doc.entityType}:${doc.entityId}`)) continue;
          if (!isSafePublicSearchHref(doc.href)) continue;
          titleItems.push({
            kind: "title",
            label: normalizeSearchText(doc.title),
            entityType: doc.entityType,
            href: doc.href,
            filterKey: null,
            filterId: null,
          });
          if (titleItems.length >= limit) break;
        }
      }
    }
  } catch (error) {
    if (
      error instanceof RepositoryError &&
      ((error.details as { adminCode?: string } | undefined)?.adminCode ===
        "SEARCH_INDEX_UNAVAILABLE" ||
        (error.details as { adminCode?: string } | undefined)?.adminCode ===
          "SEARCH_INDEX_CORRUPT")
    ) {
      // Taxonomy-only fallback below; mark incomplete.
      incomplete = true;
    } else {
      incomplete = true;
    }
  }

  const taxonomyItems: SearchSuggestionItem[] = [];
  try {
    const maps = await loadSearchTaxonomyMaps();
    const pushTaxonomy = (
      kind: "category" | "tag" | "audience",
      options: { id: string; title: string }[],
    ) => {
      const matched = options
        .filter((o) => startsWithNormalized(o.title, prefix))
        .sort(
          (a, b) =>
            a.title.localeCompare(b.title, "ru") || a.id.localeCompare(b.id),
        );
      for (const o of matched) {
        taxonomyItems.push({
          kind,
          label: o.title,
          entityType: null,
          href: null,
          filterKey: kind,
          filterId: o.id,
        });
      }
    };
    pushTaxonomy("category", maps.selectable.categories);
    pushTaxonomy("tag", maps.selectable.tags);
    pushTaxonomy("audience", maps.selectable.audiences);
  } catch {
    incomplete = true;
  }

  // Order: title (already sorted) → category → tag → audience
  const ordered = [
    ...titleItems,
    ...taxonomyItems.filter((i) => i.kind === "category"),
    ...taxonomyItems.filter((i) => i.kind === "tag"),
    ...taxonomyItems.filter((i) => i.kind === "audience"),
  ].slice(0, limit);

  if (ordered.length === 0 && incomplete && titleItems.length === 0) {
    // Index unavailable and no taxonomy hits — still ok empty, not hard fail,
    // unless both sources failed with zero taxonomy load. Soft empty is fine.
  }

  return {
    status: ordered.length === 0 ? "empty" : "ok",
    items: ordered,
    incomplete,
  };
}
