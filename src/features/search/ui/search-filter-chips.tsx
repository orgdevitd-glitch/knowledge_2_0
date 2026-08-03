import { Link } from "@/components/ui";
import {
  buildSearchHref,
  clearSearchFilters,
  removeSearchFilter,
  type SearchUrlState,
} from "@/features/search/url/search-url-state";

import styles from "./search.module.css";

export type FilterChipModel = {
  key: "type" | "category" | "tag" | "audience";
  kindLabel: string;
  title: string;
  unavailable?: boolean;
};

export function SearchFilterChips({
  state,
  chips,
}: {
  state: SearchUrlState;
  chips: FilterChipModel[];
}) {
  if (chips.length === 0) return null;

  return (
    <div className={styles.chips} aria-label="Активные фильтры">
      {chips.map((chip) => {
        const removeHref = buildSearchHref(
          removeSearchFilter(state, chip.key),
        );
        const removeLabel = `Удалить фильтр ${chip.kindLabel}: ${chip.title}`;
        return (
          <span
            key={chip.key}
            className={`${styles.chip}${chip.unavailable ? ` ${styles.chipUnavailable}` : ""}`}
          >
            <span className={styles.chipText}>
              <span className={styles.chipKind}>{chip.kindLabel}:</span>
              <span>
                {chip.unavailable ? `Недоступный фильтр (${chip.title})` : chip.title}
              </span>
            </span>
            <Link
              href={removeHref}
              className={styles.chipRemove}
              aria-label={removeLabel}
            >
              ×
            </Link>
          </span>
        );
      })}
      <Link href={buildSearchHref(clearSearchFilters(state))} variant="standalone">
        Очистить все фильтры
      </Link>
    </div>
  );
}
