# Media Model (Phase 7B)

Domain module: `src/domain/content/media.ts`. Limits: `src/domain/shared/media-limits.ts`. Sniffing: `src/domain/content/media-sniff.ts`.

## MediaAsset

Central metadata record for one uploaded binary (or failed upload attempt).

| Field | Notes |
|-------|-------|
| `id` | `MediaId` |
| `title`, `description`, `defaultAltText` | Admin-editable metadata |
| `kind` | `image` \| `document` |
| `mimeType` | Set at `ready`; null while uploading/failed |
| `originalFileName`, `fileExtension` | Sanitized display name; extension lowercased |
| `sizeBytes`, `width`, `height` | Size at ready; dimensions reserved |
| `storageProvider` | `gcs` \| `memory` |
| `storageKey` | Server-only path segment |
| `providerGeneration`, `providerChecksum`, `providerEtag` | GCS integrity hints for restore |
| `status` | `uploading` \| `ready` \| `failed` \| `archived` |
| `source` | `SourceReference` (portal default) |
| `ownerId` | Uploading admin |
| `failureReasonCode` | When `failed` |
| `uploadedAt`, `archivedAt` | Lifecycle timestamps |
| `revision` | Optimistic concurrency |

## Status transitions

```text
(upload) -> uploading -> ready | failed
failed -> uploading (retry, new storageKey)
ready | failed -> archived
archived -> ready | failed (restore validates object)
```

`markMediaReady` only from `uploading`. Ready binary **cannot** be replaced on the same entity.

## Content pointers

Articles and blocks store **`MediaId` references only** — not URLs or storage keys.

| Location | Expected kind |
|----------|----------------|
| `Article.coverMediaId` | `image` |
| `image` / `gallery` blocks | `image` |
| `file` block | `document` |
| `video.posterMediaId` | `image` |

Publish validation: `assertArticleMediaReadyForPublish` (`src/features/content/application/article-media-validation.ts`).

## Allowed types

See ADR 0011. Sniffing validates magic bytes (images, PDF) or mostly-text prefix (txt/csv). Client-declared MIME is not trusted.

## Archive & usage

- Archive is soft (`status: archived`); GCS object retained.
- `analyzeMediaUsage` scans articles (working + published snapshot), videos — bounded by `maxUsageScan`.
- Archive rejected when `totalReferences > 0` or scan incomplete.

## Firestore

Collection: `mediaAssets/{mediaId}`. Mapper in `firestore/mappers.ts`. Indexes for admin list (status, kind, updatedAt) in `firestore.indexes.json`.

## Public vs admin exposure

| Surface | Exposes |
|---------|---------|
| Admin DTO | id, metadata, status, `publicPath` when ready |
| Public delivery | bytes + mime + safe filename disposition |
| Never public | `storageKey`, bucket, signed URLs, provider checksums |

## See also

- [CONTENT-MODEL.md](./CONTENT-MODEL.md) — article `coverMediaId`
- [REPOSITORY-CONTRACTS.md](./REPOSITORY-CONTRACTS.md) — `MediaRepository`, `MediaStoragePort`
- ADR 0011
