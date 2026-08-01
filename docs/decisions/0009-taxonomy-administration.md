# ADR 0009 — Taxonomy administration (Phase 7A)

## Status

Accepted

## Context

The portal already had Category, Tag, and Audience domain entities, repositories, and Phase 3 write use cases. Administrators still could not manage taxonomy without code changes. Article editor and Google Sheets import consume taxonomy IDs from persistence.

Phase 7A adds admin UI and mutation APIs for taxonomy only. Prompt Admin, Media, and Google automatic sync remain out of scope.

## Decision

### Hierarchy and integrity

- Categories form a tree via `parentId` with max depth `CONTENT_LIMITS.categoryTreeDepth` (5).
- Cycle detection and parent existence checks run on the server (`assertNoCategoryCycle`, `assertCategoryParentUsable`).
- Archived categories cannot be chosen as new parents.
- Cascade archive is forbidden. If a Category has **active** children, archive is blocked with stable error `CATEGORY_HAS_ACTIVE_CHILDREN`. The administrator must move or archive children first so active orphans never remain under an archived parent. Archived children alone do not block parent archive.
- Archiving never rewrites materials.

### Uniqueness across statuses

- Slug uniqueness is enforced among **active and archived** entities (restore must not collide with another archived/active slug).
- Normalized Tag title uniqueness is likewise across all statuses.

### Sort order and load limits

- Category siblings and audiences use deterministic order: `sortOrder` asc, `title` asc, `id` asc.
- Reorder uses integer steps (×10) with limited sibling normalization.
- No drag-and-drop dependency.
- Taxonomy tree loads are bounded by `MAX_TAXONOMY_TREE_ITEMS` (`CONTENT_LIMITS.maxTaxonomyTreeItems`). Exceeding the limit returns a controlled `TAXONOMY_TREE_LIMIT_EXCEEDED` error; silent truncation is forbidden.

### Archive instead of delete

- Physical deletion is forbidden.
- Archive keeps IDs and material relationships.
- Restore reactivates the same entity and revision-bumps it.
- Dedicated archive/restore use cases and audit events.

### Existing relationships

- Archiving never removes `categoryIds` / `tagIds` / `audienceIds` from Article, Prompt, or Video.
- No mass rewrite of materials.

### Article editor archived taxonomy

- Active taxonomy is available for new selection.
- Already linked archived values remain visible, labeled as archived, and removable.
- After removal, an archived value cannot be re-added until restored.

### Public archived taxonomy policy

- Published materials continue to display linked taxonomy titles (including archived).
- Public filter options for a taxonomy value require **real published usage** from immutable `publishedVersion` snapshots (public catalog hydrates articles/prompts from those snapshots). Draft-only usage must not surface archived values in public filters.
- Values without published-snapshot usage are omitted from filters.
- Archiving taxonomy never hides materials.
- Unknown old slug query params are treated as inactive filters (safe empty state). No redirect system for taxonomy slug changes in Phase 7A.

### Slug changes

- Slug edits are explicit in the form (manual override after suggestion from title).
- Changing slug does not change material URLs.
- Public caches are invalidated via `PublicContentInvalidationPort.invalidateCatalogs()`.

### Optimistic concurrency

- All mutations require `expectedRevision`.
- Conflicts return `CONFLICT`; UI must not force-overwrite.

### Usage service

- `TaxonomyUsageService` distinguishes:
  - **draft usage** — working entity fields on Article / Prompt / Video;
  - **published usage** — only immutable `publishedVersion` snapshot taxonomy IDs.
- A published material’s current working draft is never counted as published usage.
- Within one metric, an entity is counted once (deduped by entity type + id).
- Usage listing is always paginated with deterministic sort; scans are bounded.

### Atomic taxonomy + audit

- Taxonomy mutations persist entity write(s) and a single `AuditEvent` together via `persistTaxonomyMutation` / `UnitOfWork.runAtomicTaxonomyMutation` (Firestore transaction when available).
- Audit is created only after a successful change path; adapters must not leave a successful taxonomy write without audit or an audit without the taxonomy change.

### Import integration

- Google Sheets resolver continues to use live Firestore/memory catalogs for **new** previews.
- Existing ImportJob preview payloads are immutable snapshots and are not rewritten when taxonomy is created, archived, or restored.
- Sheets import never auto-creates taxonomy.

### Audience vs authorization

- Audience is content metadata only.
- Admin authorization remains Firebase session + email allowlist + role `admin`.
- Audience values never grant privileges.

## Consequences

- Admin routes under `/admin/taxonomy/**` and mutation APIs under `/api/admin/taxonomy/**`.
- Audit event types expanded (`taxonomy.category.*`, `taxonomy.tag.*`, `taxonomy.audience.*`).
- Phase plan documents Phase 7A as Taxonomy Admin; Media remains a later phase.
- No new UI libraries for tree or DnD.

## Non-goals

Prompt/Video admin, media library, merge tags, physical delete, mass replacement, automatic Google sync, production deployment.
