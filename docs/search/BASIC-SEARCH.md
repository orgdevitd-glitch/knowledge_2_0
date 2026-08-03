# Basic search

## Phase 4 (legacy in-process)

`runBasicSearch` + `buildSearchDocuments` over the public catalog remain available for catalog-era tests and as ranking/highlight primitives.

See historical behavior: published-only, deterministic weights, safe `highlightSegments`.

## Phase 8B.1 (Search Foundation)

Durable search uses:

- SearchDocument v2 (`docs/search/SEARCH-DOCUMENT.md`)
- `SearchIndexPort` + Memory/GCS adapters (`docs/search/SEARCH-INDEX.md`)
- `GET /api/search` (`docs/search/SEARCH-API.md`)
- Admin `/admin/search` (`docs/search/SEARCH-OPERATIONS.md`)

ADR: [0012-search-foundation.md](../decisions/0012-search-foundation.md)

## Phase 8B.2 (Search Experience)

Public UX on the foundation: URL state, filters/chips, suggestions, result cards.

- `docs/search/SEARCH-EXPERIENCE.md`
- `docs/search/SEARCH-SUGGESTIONS.md`
- ADR: [0013-search-experience.md](../decisions/0013-search-experience.md)

## Out of scope here

Typo tolerance, morphology, analytics, semantic search, assistant (Phase 8C).
