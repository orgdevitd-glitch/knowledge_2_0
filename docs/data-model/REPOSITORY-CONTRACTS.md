# Repository Contracts

Interfaces: `src/server/repositories/interfaces`.

## Content repositories

`ArticleRepository`, `PromptRepository`, `VideoRepository`:

- `getById`, `getBySlug`, `existsBySlug`, `save`, `list`

Taxonomy: `CategoryRepository`, `TagRepository`, `AudienceRepository` (+ `listAll` where needed for tree/title checks; bounded by `maxTaxonomyTreeItems`). Usage analysis is an application service over content repositories, not a separate Firestore collection.

## Versions

`VersionRepository`:

- `getById`, `listByEntity`, `getLatestByEntity`, `saveImmutable`

## Audit

`AuditPort.append` (+ optional `AuditRepository.listByEntity` for tests).

## Shared list contract

- Pagination: `limit` (default/max from `CONTENT_LIMITS`), opaque `cursor`.
- Sort: limited union (`updatedAt_desc`, …).
- Filters: typed (`status`, taxonomy ids).
- `list` never returns an unbounded dump.

## Optimistic concurrency

`save(entity, { expectedRevision })`:

- create: no row, `expectedRevision === 0`
- update: stored revision must equal expected
- mismatch → `ConflictError`

## Unit of work

`UnitOfWork` / `FirestoreUnitOfWork.runAtomicArticlePublish` and `runAtomicPromptPublish` support atomic entity + version + audit writes. Transaction callbacks keep reads before writes and avoid external side effects.

## In-memory (TEST_ONLY)

`src/server/repositories/memory`:

- marked `MEMORY_REPOSITORY_MARKER = "TEST_ONLY_IN_MEMORY"`
- deep-cloned reads/writes
- slug uniqueness
- immutable versions
- **must not** be used as production composition (`PERSISTENCE_MODE=memory` forbidden in production)

## Firestore (Phase 5A)

Implementations in `src/server/repositories/firestore`:

- same interfaces; no Firestore types leak into domain or ports
- mappers with `schemaVersion`
- optimistic concurrency via transactions
- deny-all client Security Rules; Admin SDK only

See `docs/infrastructure/FIRESTORE-MODEL.md` and ADR 0006.
