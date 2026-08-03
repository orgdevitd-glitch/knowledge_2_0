# Content Model

Phase 3 domain model. Storage-agnostic TypeScript under `src/domain`. Repository interfaces live under `src/server/repositories/interfaces`. In-memory adapters are **TEST_ONLY**.

Related docs:

- [BLOCK-SCHEMAS.md](./BLOCK-SCHEMAS.md)
- [PUBLISHING-LIFECYCLE.md](./PUBLISHING-LIFECYCLE.md)
- [REPOSITORY-CONTRACTS.md](./REPOSITORY-CONTRACTS.md)
- ADR [0004-content-domain-model.md](../decisions/0004-content-domain-model.md)

## Principles

- Portal database is the future source of truth for **published** content.
- Domain does not depend on Next.js, React, Firestore, Firebase, HTTP, cookies, CSS, or env.
- Every publish creates an immutable `ContentVersion`.
- Physical delete is out of scope for Phase 3.
- No real portal content is seeded.

## Entities

| Entity | Module |
|--------|--------|
| Article | `src/domain/content/article.ts` |
| Prompt | `src/domain/content/prompt.ts` |
| Video | `src/domain/content/video.ts` |
| Category / Tag / Audience | `src/domain/content/taxonomy.ts` |
| ContentVersion | `src/domain/content/versioning.ts` |
| SourceReference | `src/domain/content/source.ts` |
| AuditEvent | `src/domain/content/audit.ts` |
| ContentBlock | `src/domain/content/blocks.ts` |
| MediaAsset | `src/domain/content/media.ts` (Phase 7B) |

## Identifiers

Branded IDs: `ArticleId`, `PromptId`, `VideoId`, `CategoryId`, `TagId`, `AudienceId`, `BlockId`, `VersionId`, `MediaId`, `UserId`, `AuditEventId`.

Rules: non-empty, max length, no control characters. Format is not Firestore-specific.

## Value objects

`Slug`, `Title`, `Summary`, `PlainText`, `SafeUrl`, `SortOrder`, `VersionNumber`, `IsoDateTime`, `ReviewDate`, `Revision`, `ExternalReference`, `RichTextDocument`.

Slugify: deterministic transliteration helper; uniqueness is application/repository concern.

## Statuses and transitions

Statuses: `draft` | `published` | `hidden` | `archived`.

Allowed transitions:

```text
draft -> published | archived
published -> hidden | archived
hidden -> published | archived
archived -> draft
```

Republish while already `published` creates the next version without a status change.

New materials start as `draft` with `publishedAt = null`. Restore from archive returns `draft` and clears `publishedAt`. Hide/archive keep version history.

## Article

Fields: `id`, `slug`, `title`, `summary`, `coverMediaId`, `categoryIds`, `tagIds`, `audienceIds`, `ownerId`, `authorId`, `status`, `blocks`, `relatedArticleIds`, `relatedPromptIds`, `relatedVideoIds`, `source`, `currentVersion`, `publishedVersion`, `createdAt`, `updatedAt`, `publishedAt`, `reviewDueAt`, `revision`.

Invariants:

- title and slug required
- block order = array order; `BlockId` stable across reorder
- no duplicate block ids or related ids; no self-reference
- taxonomy id lists deduplicated
- publish requires blocks, title, slug, `ownerId`
- referenced `coverMediaId` and block `mediaId` values must be **ready** at publish time (Phase 7B); draft saves may reference non-ready media
- `revision` is the optimistic concurrency token (not `updatedAt` alone)

## Prompt / Video

See entity modules. Prompt stores `promptText` (never user-filled runtime data). Publish requires `ownerId`. Admin CMS: Phase 8A — working draft vs `publishedVersion` snapshot; public reads via `promptFromPublishedSnapshot` (see [PROMPT-PUBLISHING-POLICY.md](./PROMPT-PUBLISHING-POLICY.md) and ADR 0010). Video has exactly one primary source (`mediaId` XOR `externalUrl`). Chapters must be sorted ascending; timestamps cannot exceed duration. External URLs must be HTTPS.

## MediaAsset (Phase 7B)

See [MEDIA-MODEL.md](./MEDIA-MODEL.md) and ADR 0011. Articles/blocks store `MediaId` pointers only. Upload kinds: `image`, `document`. Ready binary is immutable; delivery via `/media/[mediaId]`.

## Taxonomy

- Category: tree with configurable max depth; no self-parent; no cycles; archived category does not cascade-archive materials.
- Tag: flat; unique slug; duplicate normalized titles rejected at application level.
- Audience: data-driven groups (not hardcoded roles).
- Admin CMS: Phase 7A — see [TAXONOMY-POLICY.md](./TAXONOMY-POLICY.md) and ADR 0009.
- Physical delete is forbidden; archive keeps material relationships.

## SourceReference

Types: `portal` | `google-docs` | `google-sheets` | `google-drive` | `manual-import`.

Describes origin/sync metadata only. No OAuth secrets.

Two distinct uses:

1. **Entity provenance** (e.g. `Prompt.source`) — import/manual origin. For Prompt, publish **preserves** Sheets/import provenance (`markPromptPublished` does not wipe it).
2. **`ContentVersion.source`** — why that immutable version was created. Portal publish sets this to `portal` (`portalSource()`); it is not a replacement for entity provenance.

## Versioning

`ContentVersion`: `id`, `entityType`, `entityId`, `versionNumber` (from 1), `snapshot` (JSON-compatible), `changeSummary`, `source`, `createdBy`, `createdAt`.

Versions are immutable. Restore loads snapshot into a new draft revision; does not mutate history; does not auto-publish. Prompt version restore does not replace entity `Prompt.source` from the snapshot (`PromptSnapshot` has no source).

## Optimistic concurrency

Mutable entities carry `revision` (starts at 0). `save(entity, { expectedRevision })` compares against stored revision and returns `ConflictError` on mismatch.

## Repository interfaces

See [REPOSITORY-CONTRACTS.md](./REPOSITORY-CONTRACTS.md). Firestore adapters are Phase 4+.

## Serialization

`serialize*` / `deserialize*` in `src/domain/content/serialize.ts`. Dates are ISO-8601. Unknown fields rejected. Deserialize always validates. Unknown block schema versions error.

## Limits

Centralized in `src/domain/shared/limits.ts` (`CONTENT_LIMITS`): id/slug/title lengths, blocks per article, related ids, gallery/FAQ/steps sizes, list pagination, audit metadata bytes, category depth.

## Rich text

Structured `RichTextDocument` (schemaVersion 1): nodes `text` | `line-break`; marks `bold` | `italic` | `code` | `link`. No raw HTML. `richTextToPlain` for search/preview.

## Search documents (Phase 8B.1)

SearchDocument v2 is built only from published Article/Prompt snapshots (not working drafts). Stable id `${entityType}:${entityId}`. See `docs/search/SEARCH-DOCUMENT.md`. Video is not indexed in production search.

## Blocks

All 22 Phase 3 types have domain schemas. Details: [BLOCK-SCHEMAS.md](./BLOCK-SCHEMAS.md). Prompt blocks reference `PromptId` (not embedded dual source of truth).

## Audit

Events via `AuditPort`. Metadata is size-limited and must not include full snapshots/secrets. Cloud Logging is out of scope for Phase 3.

## Future Firestore integration

Adapters implement the same repository interfaces with transactional publish (version + entity + audit). Domain and use cases stay unchanged.
