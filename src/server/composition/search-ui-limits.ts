import "server-only";

import { getSearchLimits } from "@/config/search-env";

/**
 * Public UI limits resolved from the same Search Foundation config as
 * server validation. Pass numeric values into client islands via props —
 * never import this module (or search-env) from client components.
 */
export function getPublicSearchUiLimits(): { queryMaxLength: number } {
  return { queryMaxLength: getSearchLimits().queryMaxLength };
}
