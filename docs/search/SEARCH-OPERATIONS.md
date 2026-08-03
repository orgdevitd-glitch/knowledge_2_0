# Search operations (Phase 8B.1)

Admin UI: `/admin/search`

Shows safely:

- active generation ID / createdAt
- validation status (`ok` | `corrupt` | `unavailable` | `empty`)
- document / active counts
- index mode
- unresolved failure codes
- rebuild / reindex actions

Rebuild conflict (`SEARCH_INDEX_REBUILD_CONFLICT`) means restart rebuild from current state. Does not flip a stale candidate.

Mutations: admin auth + CSRF + Origin + rate limit. No bucket/object paths, provider generations, HMAC secrets, raw GCS errors, query text, or content bodies in UI.

Production monitoring (manual): failed mutations, CAS/rebuild conflicts, oversized index, orphan generations, corruption. No automatic sweeper / retry worker in 8B.1.
