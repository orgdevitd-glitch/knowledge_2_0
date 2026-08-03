# ADR 0013 — Search Experience (Phase 8B.2)

## Status

Accepted (acceptance-hardened)

## Context

Phase 8B.1 delivered SearchDocument v2, GCS/memory index, `GET /api/search`, live visibility, and cursors. Public UX needed filters, suggestions, chips, and honest empty/cursor states without weakening foundation contracts.

## Decision

1. **Taxonomy IDs in Search URL** (`category` / `tag` / `audience` = entity IDs). Catalog continues to use slugs; Search URL does not mix ID and slug.
2. **Canonical URL state helpers** with parameter order `q → type → category → tag → audience → cursor`. Changing q or any filter clears cursor. Clear-all filters keeps `q`.
3. **`/search` stays a Server Component** calling `executePublicSearch` directly (no self-HTTP). Small client islands for suggestions combobox, pending submit, and `#search-results` focus.
4. **Separate `GET /api/search/suggestions`** with its own rate limiter, `force-dynamic`, `Cache-Control: private, no-store`. Title suggestions from current index + live visibility; taxonomy suggestions from active public taxonomy only.
5. **Title suggestion navigates** to published `href` (only after internal href validation). **Taxonomy suggestion applies filter ID**, preserves `q` and other filters, clears cursor.
6. **Forward-only cursor links** (“Следующая страница”). Browser Back returns to the previous cursor page. No page numbers, no client load-more accumulation. “К началу результатов” drops cursor.
7. **No SearchDocument / GCS schema change.** Taxonomy display titles resolve on the page/server layer, not inside SearchDocument. `schemaVersion` remains **2**.
8. **Mobile filters use native `<details>` disclosure** wrapping the **same** select controls as desktop (CSS repositions; no duplicated name= controls).
9. **Honest result count:** “Показано материалов на этой странице: N” — never fake totals or “Найдено N” from page size alone.
10. **Runtime `SEARCH_QUERY_MAX_LENGTH`** is resolved server-side via Search Foundation config and passed into Header/Home/Page client forms as a numeric prop (no `NEXT_PUBLIC` search limits; no client import of server-only env).
11. **Multiple combobox instances** (header + page) use per-instance `useId`, timers, AbortControllers, and request sequence guards.
12. **Title suggestions respect content filters** (`type` / `category` / `tag` / `audience`) **before** limit. **Taxonomy suggestions do not depend on content type** (active taxonomy prefix match only).
13. **Public search hrefs** may only be `/articles/{slug}` or `/prompts/{slug}` matching the existing slug contract; unsafe hrefs are fail-closed (excluded from API/UI; no open redirect).
14. **Focus on `#search-results`** only after explicit search UX intent (submit / next / cursor CTA), not bare shared URL or Back/Forward alone; respects `prefers-reduced-motion`.

## Consequences

- Shareable Search URLs carry filter IDs; unknown IDs show an “unavailable filter” chip without 500.
- Suggestions may be unavailable while main search still works.
- Corrupt generation hrefs fail generation validation (`SEARCH_INDEX_CORRUPT`).
- Phase 8C Knowledge Assistant, semantic search, morphology, analytics, and query history remain out of scope.
