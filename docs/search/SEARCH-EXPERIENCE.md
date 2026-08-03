# Search Experience (Phase 8B.2)

Public UX on top of [Search Foundation](./SEARCH-INDEX.md) / [BASIC-SEARCH](./BASIC-SEARCH.md).

## What this phase is

| Layer | Role |
| --- | --- |
| Phase 4 Basic Search | In-process demo/catalog helpers |
| Phase 8B.1 Search Foundation | Durable index, API, visibility, cursors |
| Phase 8B.2 Search Experience | `/search` UX, URL state, filters, suggestions, a11y |
| Phase 8C Knowledge Assistant | Not implemented here |

## URL state

Helpers: `src/features/search/url/search-url-state.ts`.

Params (canonical order): `q`, `type`, `category`, `tag`, `audience`, `cursor`.

- Taxonomy values are **IDs**.
- Changing `q` or any filter removes `cursor`.
- Clear filters keeps `q`; clear `q` keeps filters.
- Unknown query keys ignored; empty values omitted.
- Shareable; Back/Forward restore state via the URL.

## Runtime query max length

`SEARCH_QUERY_MAX_LENGTH` is resolved by Search Foundation `getSearchLimits()` and exposed to UI via `getPublicSearchUiLimits()` → numeric `maxLength` / `queryMaxLength` **props** into Header, Home, and Page client forms.

- No `NEXT_PUBLIC_*` search limit variables.
- Client components must not import `search-env` / server composition.
- Invalid env values stay fail-closed (same as Foundation).

## Page architecture

- Server Component `/search` → `executePublicSearch` + `loadSearchTaxonomyMaps`.
- Client islands: `SearchPageForm`, `SearchInputWithSuggestions`, `SearchResultsFocus`.
- Header/home use `HeaderSearchForm` / `GlobalSearchForm` **without** carrying prior page filters.
- Header + page comboboxes may render together; each instance has unique `useId`-scoped IDs and isolated timers/AbortControllers/request sequence.

## Filters and chips

Single-select type / category / tag / audience. **One physical set** of `<select name=…>` controls; mobile `<details>` wraps the same set (CSS layout only).

Active chips with accessible remove labels. Unknown IDs → “Недоступный фильтр” chip; ID still passed to search.

## Results and href safety

`SearchResultCard`: type badge, title link, structured highlight (`<mark>` text only), category/tags. Snippet prefers highlight match over summary.

Public hrefs must pass `isSafePublicSearchHref` (`/articles/{slug}` or `/prompts/{slug}` only). Unsafe hrefs are excluded fail-closed (generation validation, query results, suggestions, card render). No open redirect.

Count copy: “Результаты поиска” + “Показано материалов на этой странице: N”.

Pagination: next cursor link + “К началу результатов”. Focus on `#search-results` only after **explicit intent** (submit / next / cursor CTA), not bare shared URL or Back/Forward alone; scroll respects `prefers-reduced-motion`.

## States

Empty / short / long query, no-results, invalid/expired cursor, unavailable, pending submit — each with distinct UX (see page). Cursor errors keep q+filters, drop only cursor.

## Out of scope

Assistant, semantic search, embeddings, fuzzy/typo/morphology, analytics, query history, personalization, Video indexing, exact total count, backward cursor, page numbers, WCAG certification claim, production deployment checklist beyond existing foundation ops.
