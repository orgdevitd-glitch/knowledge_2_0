# Conflict handling (Phase 5B)

Optimistic concurrency uses domain `revision`.

1. Client sends `expectedRevision`.
2. Repository compares stored revision.
3. Mismatch → `ConflictError` → HTTP 409 `CONFLICT`.
4. UI shows ConflictAlert: local edits kept; user may reload server data or stay on local draft.
5. No “save anyway” overwrite and no automatic block merge.

Phase 5B recovery: copy changes manually if needed, reload, re-apply.
