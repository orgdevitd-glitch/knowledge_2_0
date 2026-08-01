# Publishing Lifecycle

## Create

1. Material created as `draft`.
2. `publishedAt` is null; `publishedVersion` is null.
3. Audit: `content.created`.

## Publish

Application steps (`publishArticle` / `publishPrompt` / `publishVideo`):

1. Load entity.
2. Check optimistic `expectedRevision`.
3. Allow publish from `draft`/`hidden`, or republish when already `published`.
4. Run publish validation (title, slug, owner, content/source rules).
5. Allocate next `versionNumber`.
6. Persist immutable `ContentVersion` snapshot (portal source).
7. Update entity: `status=published`, `publishedVersion`, `publishedAt`, bump `revision`.
8. Audit: `content.published` (metadata without full snapshot).
9. Return result.

Logical atomicity: `UnitOfWork` port. Phase 3 in-process UoW is sequential. Future Firestore adapters must transactionally commit version + entity + audit.

## Hide / Archive / Restore archive

- Hide: `published → hidden`; keeps published version.
- Archive: from published/hidden/draft → `archived`; history kept.
- Restore archive: `archived → draft`; clears `publishedAt`.

## Restore version

1. Load version; verify entity ownership.
2. Apply snapshot as new draft working state.
3. Bump revision; do not mutate historical version; do not auto-publish.
4. Audit: `version.restored`.

## Forbidden

- Undocumented status transitions.
- Publishing empty article blocks / empty prompt text / video without source.
- Editing existing `ContentVersion` records.
