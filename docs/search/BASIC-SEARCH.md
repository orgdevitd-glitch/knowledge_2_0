# Basic search

## Phase 4 (legacy in-process)

`runBasicSearch` + `buildSearchDocuments` over the public catalog remain available for catalog-era tests and as ranking/highlight primitives.

See historical behavior: published-only, deterministic weights, safe `highlightSegments`.

## Phase 8B.1 (current foundation)

Durable search uses:

- SearchDocument v2 (`docs/search/SEARCH-DOCUMENT.md`)
- `SearchIndexPort` + Memory/GCS adapters (`docs/search/SEARCH-INDEX.md`)
- `GET /api/search` (`docs/search/SEARCH-API.md`)
- Admin `/admin/search` (`docs/search/SEARCH-OPERATIONS.md`)

ADR: [0012-search-foundation.md](../decisions/0012-search-foundation.md)

## Out of scope here

Suggestions, typo tolerance, morphology, analytics, semantic search, assistant (Phase 8B.2 / 8C).
