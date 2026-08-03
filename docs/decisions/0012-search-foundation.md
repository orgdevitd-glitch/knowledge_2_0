# ADR 0012 — Search Foundation (Phase 8B.1)

## Status

Accepted (acceptance-hardened)

## Context

Phase 4 shipped in-process search over a bounded public catalog. Production needs a durable published-only index with concurrency-safe updates after publish/hide/archive.

## Decision

1. **SearchDocument v2** from immutable published snapshots only (`sourceRevision` = post-transaction aggregate revision + `versionId`/`versionNumber`).
2. **SearchIndexPort** with Memory (test/dev) and **GCS immutable generations** + CAS manifest flip.
3. **Two CAS contracts:**
   - Entity mutation: may retry against the latest current generation (re-apply mutation after re-read).
   - Full rebuild: capture baseline providerGeneration/generationId before scan; flip only against that baseline; on conflict abort with `SEARCH_INDEX_REBUILD_CONFLICT` (restart required). Never blind-retry a stale rebuild candidate. Orphan candidate generations stay inactive.
4. **Tombstones** for hide/archive; full rebuild includes minimal tombstones for hidden/archived entities so delayed lower-revision upserts cannot resurrect after rebuild.
5. Index updates are **best-effort after** successful content transactions via `content-search-orchestration` (not only route handlers); failures recorded in `searchIndexFailures` without rolling back publish.
6. Failure resolution marks resolved only failures with `sourceRevision <= processed` and `occurredAt <= retry start`.
7. Public **`GET /api/search`** is force-dynamic / `private, no-store`; integrity-protected cursors use a shared `SEARCH_CURSOR_HMAC_SECRET`; ranking freshness uses **generation.createdAt** (not wall clock); nextCursor tracks last **scanned** candidate after the live visibility gate.
8. Corrupt current generation → safe temporary unavailable (no silent previousGeneration fallback).
9. Video, suggestions, semantic search, embeddings, Knowledge Assistant, automatic retry workers, and automatic orphan cleanup are **out of scope**.

## Consequences

- Demo/local memory mode requires rebuild/reindex (or publish hooks) to populate the index.
- Admins must restart rebuild after `SEARCH_INDEX_REBUILD_CONFLICT`.
- Phase 8B.2 adds search experience polish; Phase 8C adds assistant retrieval on this foundation (Prompt text remains untrusted reference material).
