# Taxonomy usage

`TaxonomyUsageService` reports which materials reference a taxonomy id.

## Counts

- `articleCount`, `promptCount`, `videoCount`, `totalCount`
- `hasPublishedUsage`, `hasDraftUsage`
- `recentUsages` (bounded)

## Listing

- Deterministic sort: title, entityType, entityId
- Cursor pagination with limited page size

## Semantics

Usage is an administrative reference count. It is **not** popularity analytics.

Archive is allowed with usage; the UI must warn that links remain on materials.
