# Search API (Phase 8B.1)

`GET /api/search` — `export const dynamic = "force-dynamic"`.

Response headers: `Cache-Control: private, no-store` (no shared cache poisoning via query params).

Query: `q`, `type`, `category`, `tag`, `audience`, `cursor`, `limit`.

Empty `q` → empty items (no catalog dump, no suggestions).

## Ranking

Deterministic within a generation. Freshness uses **generation.createdAt** as the sole reference time (not request wall-clock). Cursor pagination within the same generation yields stable scores/order.

## Cursor + live gate

Cursor is HMAC-integrity protected (`SEARCH_CURSOR_HMAC_SECRET`; required in production, min length enforced, shared across instances, never project-id fallback).

Cursor position is the last **scanned** candidate after live visibility filtering (not merely the last returned item). Missing generation → `SEARCH_CURSOR_EXPIRED`.

Live visibility is batch-oriented with centralized batch size / scan bounds; fail-closed on repository errors.
