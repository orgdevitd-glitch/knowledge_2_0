import { getPublicSearchUiLimits } from "@/server/composition/search-ui-limits";
import { GlobalSearchForm } from "@/features/search/ui/search-input-with-suggestions";

/**
 * Header / home search entry (Server Component).
 * Resolves runtime query max length from Search Foundation config and passes
 * it into the client form — never imports search-env into client code.
 */
export function HeaderSearchForm({
  defaultQuery = "",
  variant = "header",
  queryMaxLength,
}: {
  defaultQuery?: string;
  /** @deprecated action is always /search; kept for call-site compatibility */
  action?: string;
  variant?: "header" | "home";
  /**
   * Optional override from parent Server Component. When omitted, resolved
   * via getPublicSearchUiLimits() (same source as server validation).
   */
  queryMaxLength?: number;
}) {
  const maxLength =
    queryMaxLength ?? getPublicSearchUiLimits().queryMaxLength;
  return (
    <GlobalSearchForm
      variant={variant}
      defaultQuery={defaultQuery}
      maxLength={maxLength}
    />
  );
}
