import { parseSlug } from "@/domain/shared/value-objects";
import { PUBLIC_CONTENT_LIMITS, PUBLIC_SORTS } from "./limits";

export const CATALOG_PATHS = ["/materials", "/articles", "/prompts"] as const;
export type CatalogPath = (typeof CATALOG_PATHS)[number];

export type CatalogHrefParams = {
  type?: string | null;
  category?: string | null;
  tag?: string | null;
  audience?: string | null;
  sort?: string | null;
  q?: string | null;
  page?: string | number | null;
};

function isCatalogPath(value: string): value is CatalogPath {
  return (CATALOG_PATHS as readonly string[]).includes(value);
}

/**
 * Catalog taxonomy values reuse the domain slug contract
 * (`parseSlug`: lowercase latin, digits, single hyphens). Not a free href.
 */
export function parseCatalogSlug(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseSlug(trimmed);
  } catch {
    return null;
  }
}

export function isSafeCatalogSlug(value: string): boolean {
  return parseCatalogSlug(value) !== null;
}

export function parseCatalogQuery(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("://") || trimmed.includes("//")) return null;
  if (trimmed.includes("\0")) return null;
  if (trimmed.length > PUBLIC_CONTENT_LIMITS.searchMaxQueryLength) {
    return trimmed.slice(0, PUBLIC_CONTENT_LIMITS.searchMaxQueryLength);
  }
  return trimmed;
}

function parsePage(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 2) return null;
  return Math.floor(n);
}

/**
 * Allowlisted catalog query string. Pagination omitted unless `page` >= 2.
 */
export function catalogFilterSearchParams(
  params: CatalogHrefParams = {},
): URLSearchParams {
  const search = new URLSearchParams();

  if (params.type === "article" || params.type === "prompt") {
    search.set("type", params.type);
  }
  const category = parseCatalogSlug(params.category);
  if (category) search.set("category", category);
  const tag = parseCatalogSlug(params.tag);
  if (tag) search.set("tag", tag);
  const audience = parseCatalogSlug(params.audience);
  if (audience) search.set("audience", audience);
  if (params.sort && (PUBLIC_SORTS as readonly string[]).includes(params.sort)) {
    search.set("sort", params.sort);
  }
  const q = parseCatalogQuery(params.q);
  if (q) search.set("q", q);
  const page = parsePage(params.page);
  if (page) search.set("page", String(page));

  return search;
}

/**
 * Build a shareable catalog URL from allowlisted keys only.
 * Unknown/unsafe values are dropped. Pagination is omitted unless `page` >= 2.
 */
export function catalogFilterHref(
  basePath: string,
  params: CatalogHrefParams = {},
): string {
  const path = isCatalogPath(basePath) ? basePath : "/materials";
  const qs = catalogFilterSearchParams(params).toString();
  return qs ? `${path}?${qs}` : path;
}

export function taxonomyCatalogHref(
  kind: "category" | "tag" | "audience",
  ref: { slug: string; status: "active" | "archived" },
): string | null {
  if (ref.status !== "active") return null;
  const slug = parseCatalogSlug(ref.slug);
  if (!slug) return null;
  return catalogFilterHref("/materials", { [kind]: slug });
}
