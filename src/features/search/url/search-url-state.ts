/**
 * Canonical public Search URL state (Phase 8B.2).
 * Taxonomy values are IDs (not slugs). Cursor is generation-bound.
 */

export type SearchUrlState = {
  q: string;
  type: "article" | "prompt" | null;
  category: string | null;
  tag: string | null;
  audience: string | null;
  cursor: string | null;
};

export const SEARCH_URL_PARAM_ORDER = [
  "q",
  "type",
  "category",
  "tag",
  "audience",
  "cursor",
] as const;

const KNOWN = new Set<string>(SEARCH_URL_PARAM_ORDER);

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseType(raw: string | null): "article" | "prompt" | null {
  if (raw === "article" || raw === "prompt") return raw;
  return null;
}

/** Parse search params; unknown keys ignored; empty values dropped. */
export function parseSearchUrlState(
  input: URLSearchParams | Record<string, string | string[] | undefined | null>,
): SearchUrlState {
  const get = (key: string): string | null => {
    if (input instanceof URLSearchParams) {
      return clean(input.get(key));
    }
    const value = input[key];
    if (Array.isArray(value)) return clean(value[0] ?? null);
    return clean(value ?? null);
  };

  return {
    q: get("q") ?? "",
    type: parseType(get("type")),
    category: get("category"),
    tag: get("tag"),
    audience: get("audience"),
    cursor: get("cursor"),
  };
}

export type SearchUrlPatch = Partial<{
  q: string | null;
  type: "article" | "prompt" | null;
  category: string | null;
  tag: string | null;
  audience: string | null;
  cursor: string | null;
}>;

/**
 * Merge patch into state. Changing q/type/category/tag/audience clears cursor
 * unless the patch explicitly sets cursor after those fields (not recommended).
 */
export function applySearchUrlPatch(
  current: SearchUrlState,
  patch: SearchUrlPatch,
): SearchUrlState {
  const next: SearchUrlState = { ...current };
  let clearCursor = false;

  if ("q" in patch) {
    next.q = clean(patch.q) ?? "";
    if (next.q !== current.q) clearCursor = true;
  }
  if ("type" in patch) {
    next.type = parseType(clean(patch.type) ?? null);
    if (next.type !== current.type) clearCursor = true;
  }
  if ("category" in patch) {
    next.category = clean(patch.category);
    if (next.category !== current.category) clearCursor = true;
  }
  if ("tag" in patch) {
    next.tag = clean(patch.tag);
    if (next.tag !== current.tag) clearCursor = true;
  }
  if ("audience" in patch) {
    next.audience = clean(patch.audience);
    if (next.audience !== current.audience) clearCursor = true;
  }

  if (clearCursor) {
    next.cursor = null;
  }
  if ("cursor" in patch && !clearCursor) {
    next.cursor = clean(patch.cursor);
  }
  return next;
}

export function clearSearchFilters(state: SearchUrlState): SearchUrlState {
  return {
    q: state.q,
    type: null,
    category: null,
    tag: null,
    audience: null,
    cursor: null,
  };
}

export function clearSearchQuery(state: SearchUrlState): SearchUrlState {
  return {
    ...state,
    q: "",
    cursor: null,
  };
}

export function removeSearchFilter(
  state: SearchUrlState,
  key: "type" | "category" | "tag" | "audience",
): SearchUrlState {
  return applySearchUrlPatch(state, { [key]: null });
}

/** Build query string in canonical order; empty values omitted. */
export function serializeSearchUrlState(state: SearchUrlState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.type) params.set("type", state.type);
  if (state.category) params.set("category", state.category);
  if (state.tag) params.set("tag", state.tag);
  if (state.audience) params.set("audience", state.audience);
  if (state.cursor) params.set("cursor", state.cursor);
  return params.toString();
}

export function buildSearchHref(
  state: SearchUrlState,
  options?: { hash?: string | null },
): string {
  const qs = serializeSearchUrlState(state);
  const hash = options?.hash ? `#${options.hash.replace(/^#/, "")}` : "";
  return qs ? `/search?${qs}${hash}` : `/search${hash}`;
}

export function buildSearchHrefFromPatch(
  current: SearchUrlState,
  patch: SearchUrlPatch,
  options?: { hash?: string | null },
): string {
  return buildSearchHref(applySearchUrlPatch(current, patch), options);
}

/** Drop unknown params when rebuilding from a raw URLSearchParams. */
export function canonicalizeSearchParams(raw: URLSearchParams): URLSearchParams {
  const state = parseSearchUrlState(raw);
  const out = new URLSearchParams(serializeSearchUrlState(state));
  // Ensure we only keep known keys (already true via serialize).
  for (const key of [...out.keys()]) {
    if (!KNOWN.has(key)) out.delete(key);
  }
  return out;
}

export function hasActiveSearchFilters(state: SearchUrlState): boolean {
  return Boolean(state.type || state.category || state.tag || state.audience);
}
