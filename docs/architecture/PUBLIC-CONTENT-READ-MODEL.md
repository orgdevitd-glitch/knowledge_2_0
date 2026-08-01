# Public content read model

## Flow

```text
Public route
  → public query (src/features/public-content/queries.ts)
  → composition root (src/server/composition/public-content.ts)
  → PublicContentSource (empty | demo | firestore)
  → visibility filter (published only)
  → public DTOs (MaterialSummary, ArticleDetail, PromptDetail, …)
  → UI
```

## Sources

| Mode | When | Notes |
|------|------|-------|
| `empty` | production default | No materials |
| `demo` | development/test | Forbidden in production |
| `firestore` | when configured | Server Admin SDK only; prompts/videos empty until adapters land |

## Rules

- UI never imports domain entities for mutation or demo fixtures.
- Read models omit `revision`, `ownerId`, audit, source internals.
- Related content and prompt blocks resolve published peers in batch in the query layer.
- Cache invalidation after publish is a future adapter concern; domain stays free of Next.js cache APIs.

## Media

`MediaPresentationResolver` returns `unavailable` in Phase 4. Cloud Storage will plug in later without changing renderers.
