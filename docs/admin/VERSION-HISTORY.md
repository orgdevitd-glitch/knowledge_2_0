# Version history (Phase 5B)

## List

`/admin/articles/[id]/versions` — versionNumber desc, pagination, no full snapshots in list.

## Detail

`/admin/articles/[id]/versions/[versionId]` — immutable snapshot rendered with public block registry (admin-only).

## Restore

`POST .../versions/[versionId]/restore`:

- Replaces current draft from snapshot
- Does not mutate historical ContentVersion
- Does not publish
- Bumps revision + audit `version.restored`
- Redirects to editor

Confirmation warns that the current draft is replaced; published public page unchanged until a new publish.
