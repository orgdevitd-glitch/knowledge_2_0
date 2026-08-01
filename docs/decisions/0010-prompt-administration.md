# ADR 0010 — Prompt administration (Phase 8A)

## Status

Accepted

## Context

Phase 3 defined the Prompt domain entity, repositories, and publish use cases. Phase 6A added Firestore persistence and Google Sheets import into **draft** prompts. Phase 7A delivered taxonomy admin. Administrators still could not manage prompts in the CMS without code changes or re-import only.

Phase 8A adds admin UI and mutation APIs for prompts only. Video Admin, Media (7B), and Google automatic sync (6B) remain out of scope.

## Decision

### Scope

- Admin routes under `/admin/prompts/**` and mutation APIs under `/api/admin/prompts/**`.
- Full CRUD-style draft editing, lifecycle actions, version history, and saved draft preview.
- Reuses Article editor patterns (manual save, conflict UI, taxonomy pickers) without a block editor.

### Snapshot model

- Public reads use `promptFromPublishedSnapshot` from immutable `publishedVersion` ContentVersion.
- Working draft edits do not affect public until republish.
- See `docs/data-model/PROMPT-PUBLISHING-POLICY.md`.

### Immutable versions

- Publish creates append-only `ContentVersion` with `PromptSnapshot`.
- Hide/archive do not create versions.
- Historical versions are never mutated.

### Manual publish

- No autosave; no auto-publish from import or save.
- Publish requires explicit admin action with optional `changeSummary`.

### Archive not delete

- Physical deletion forbidden.
- Archive retains history and `publishedVersion` reference.
- Restore archive → `draft` (clears `publishedAt`); does not auto-publish.

### Restore version to draft

- `restorePromptVersion` applies snapshot to working copy only.
- Does not publish; public unchanged until new publish.

### Taxonomy archived policy

- Same as Article editor (ADR 0009): active values for new selection; linked archived values remain visible/removable; newly attaching archived taxonomy rejected server-side.

### Imported prompts editable

- Sheets-imported drafts (and published prompts' working copies) are editable in Prompt Admin.
- Import confirm still never auto-publishes.

### Source provenance (entity vs version)

Two distinct concepts:

1. **Prompt.source (`SourceReference`)** — entity import provenance: `type`, `externalId`, `connectionId` (SourceConnection), `lastImportJobId`, sync timestamps. Survives edit, publish, republish, hide, archive, restore, and version restore. Manual prompts use `portal` / `manual-import` without a fake SourceConnection.
2. **ContentVersion.source** — creation reason for that immutable version (portal publish action via `portalSource()`). Not a replacement for entity provenance. `PromptSnapshot` does not carry import provenance.

- `markPromptPublished` **preserves** `Prompt.source` (does not wipe Sheets provenance).
- Version restore applies content snapshot fields only; entity `SourceReference` is kept.
- Public DTOs never expose `SourceReference` / connection / ImportJob ids.
- Audit metadata may include `sourceType` / `hasExternalId` only — never full source payload, checksum, or credentials.

### External ID boundary

- Uniqueness is **source-scoped**: `(sourceType, connectionId, externalId)` via denormalized Firestore fields + `findBySourceExternalId`.
- Same row `externalId` in two SourceConnections does not collide.
- Sheets preview/confirm resolve targets through `findBySourceExternalId`, not a truncated list.
- Import-managed `externalId` / `connectionId` cannot be silently rewritten by admin draft updates.
- No global unique index on `externalId` alone; slug uniqueness remains global per prompt.

### Admin list pagination

- Cursor pagination with deterministic sort and id tie-breaker (`listAdmin`).
- Supported Firestore filters: status, sourceType, single taxonomy `array-contains`, sorts updated/title/created.
- Text `q` uses a bounded scan (`maxPromptAdminScan`) and returns `scanLimitExceeded` instead of silent truncation.
- At most one taxonomy filter per query; incompatible multi-filters are rejected.

### Optimistic concurrency

- All mutations require `expectedRevision`.
- Conflicts return `CONFLICT`; UI must not force-overwrite.

### Atomic audit

- All Prompt mutations use `runAtomicPromptMutation` / `runAtomicPromptPublish` (prompt + optional ContentVersion + audit in one Firestore transaction; Memory UoW rolls back on failure).
- Public invalidation runs only after successful commit in API routes.

### Invalidation

- `PublicContentInvalidationPort.invalidatePrompt` on publish, hide, and archive.

### Editor UX constraints

- No WYSIWYG — plain textareas for `promptText` and optional fields.
- No autosave.
- No new UI library dependencies (`pick-ui-library` not invoked; same primitives as Article editor).

### Google write-back

- No write APIs to Sheets/Docs/Drive.
- Re-import remains the Sheets update path (Phase 6A).

## Consequences

- `FirestorePublicContentSource` serves published prompts from snapshots (no longer empty for prompts).
- Composite index `prompts`: `status ASC`, `updatedAt DESC`.
- Phase plan documents Phase 8A; Phase 8 Search remains later.
- Package description and agent index updated to Phase 8A.

## Non-goals

Video admin, media library, merge prompts, physical delete, mass rewrite, automatic Google sync, semantic search, production deployment, Google write-back, WYSIWYG, autosave, new UI libraries.
