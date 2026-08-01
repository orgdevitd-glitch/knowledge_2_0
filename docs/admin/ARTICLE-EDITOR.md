# Article editor (Phase 5B)

## Purpose

Administrators create and edit articles as drafts, then publish via the domain publishing flow.

## Routes

| Route | Role |
|-------|------|
| `/admin/articles` | List + actions |
| `/admin/articles/new` | Explicit create form |
| `/admin/articles/[id]` | Detail + recent audit |
| `/admin/articles/[id]/edit` | Metadata + block editor |
| `/admin/articles/[id]/preview` | Saved draft preview (`noindex`) |
| `/admin/articles/[id]/versions` | Version list |
| `/admin/articles/[id]/versions/[versionId]` | Snapshot + restore |

## Save strategy

- **Manual save** is the primary mechanism (separate metadata / blocks endpoints).
- Autosave is not used in Phase 5B.
- `expectedRevision` on every mutation; `CONFLICT` never force-overwrites.
- Dirty leave guard: `beforeunload` + in-app confirm.

## Actor IDs

`ownerId` / `authorId` / audit `actorId` come from `AdminPrincipal.uid` via `UserId.parse` on the server. Clients cannot set actor or status.

## See also

- [BLOCK-EDITOR.md](./BLOCK-EDITOR.md)
- [ARTICLE-PUBLISHING.md](./ARTICLE-PUBLISHING.md)
- [CONFLICT-HANDLING.md](./CONFLICT-HANDLING.md)
- ADR 0007
