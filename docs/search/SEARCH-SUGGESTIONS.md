# Search Suggestions (Phase 8B.2)

`GET /api/search/suggestions` — separate from `GET /api/search`.

## Contract

- `dynamic = "force-dynamic"`
- `Cache-Control: private, no-store`
- Dedicated rate limiter (`publicSearchSuggestionsLimiter`)
- Zod validation; query length limits aligned with Search Foundation
- Does not persist or fully log `q`
- Fail-closed / soft-empty on index issues; no raw provider errors

### Query

`q`, optional `type`, `category`, `tag`, `audience`, `limit`.

Minimum prefix: `suggestionsMinPrefix`. No request expected from the combobox below that length.

### Response item

```ts
{
  kind: "title" | "category" | "tag" | "audience";
  label: string;
  entityType: "article" | "prompt" | null;
  href: string | null;
  filterKey: "category" | "tag" | "audience" | null;
  filterId: string | null;
}
```

Plus `items`, `status` (`ok` | `empty` | via HTTP for unavailable), optional `incomplete`.

Never returns: revision, versionId, sourceRevision, scores, body/prompt/searchable text, generationId, storage/source/provider metadata, archived taxonomy internals.

## Sources

**Titles:** active SearchDocuments in the current generation; published-only; live visibility required; prefix on normalized title; **content filters (`type` / `category` / `tag` / `audience`) applied before scan/limit**; safe internal href only; bounded scan (`suggestionsTitleScanLimit`).

**Taxonomy:** active public Categories / Tags / Audiences; prefix on title. **Taxonomy suggestions do not depend on content type** (or other content filters) — active taxonomy catalog only.

Forbidden: drafts, hidden, archived content, archived taxonomy for suggestions, body suggestions, query history, popular queries, personalization.

## Ordering

1. Exact title match (normalized title === prefix)
2. Remaining title prefix matches (stable title/id)
3. Category → Tag → Audience (stable title/id)

No AI ranking, no popularity.

## Client interaction

Accessible combobox (no new UI dependency): debounce, AbortController **plus request sequence guard** (stale responses cannot overwrite newer results), active descendant, ArrowUp/Down, Enter, Escape, outside click, IME-safe. Multiple instances on one page are fully isolated.

Title → navigate safe `href` (no search-results focus intent). Taxonomy → apply filter on canonical Search URL (with focus intent).

Main search page keeps working if suggestions fail (rate limit / 503 → neutral message, no search error).
