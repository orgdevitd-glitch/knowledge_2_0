# Article publishing (Phase 5B)

## Flow

1. Admin confirms publish with optional `changeSummary`.
2. `POST /api/admin/articles/[id]/publish` with CSRF + `expectedRevision`.
3. `assertArticlePublishable` then `publishArticle` use case.
4. Firestore: `runAtomicArticlePublish` writes article + ContentVersion + AuditEvent atomically.
5. `PublicContentInvalidationPort` revalidates public paths.

## Lifecycle

| Action | Endpoint | Notes |
|--------|----------|-------|
| Publish / republish | `.../publish` | Creates version |
| Hide | `.../hide` | published → hidden; keeps publishedVersion |
| Archive | `.../archive` | Removes from public |
| Restore archive | `.../restore` | → draft; not auto-published |

Hide/archive do not create ContentVersions.

## Public visibility

Only `status === published` is readable publicly (unchanged Phase 4 policy).
