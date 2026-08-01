# Media Admin (Phase 7B)

Administrators upload and manage **images** and **documents** for use in articles (cover, image/gallery/file blocks, video posters). Video/audio binary upload is not supported in this phase.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/media` | List, filters (status, kind), search |
| `/admin/media/new` | Start upload (kind, title, file picker) |
| `/admin/media/[mediaId]` | Detail, status, failure reason, public path |
| `/admin/media/[mediaId]/edit` | Metadata (title, description, default alt) |

All routes require admin session and send `noindex`.

## Upload UX

1. Admin selects kind (`image` | `document`), title, and file.
2. Client calls `POST /api/admin/media/uploads` → receives `uploadUrl`, `expiresAt`, `requiredHeaders`, and media DTO (`status: uploading`).
3. Client PUTs bytes with `requiredHeaders` to signed URL (GCS) or same-origin upload-proxy (memory mode).
4. Client calls `POST /api/admin/media/[mediaId]/complete` with `expectedRevision`.
5. On success, `status` becomes `ready` and `publicPath` is `/media/{id}`.

Failed uploads show `failureReasonCode`; admin may **retry** (new storage key, failed status only).
Expired upload URLs while still `uploading` use **reissue-upload** (same storage key).

## Mutations

See [MEDIA-MUTATION-FLOW.md](../architecture/MEDIA-MUTATION-FLOW.md).

| Action | Endpoint |
|--------|----------|
| Start upload | `POST /api/admin/media/uploads` |
| Complete upload | `POST /api/admin/media/[mediaId]/complete` |
| Reissue upload URL | `POST /api/admin/media/[mediaId]/reissue-upload` |
| Retry failed upload | `POST /api/admin/media/[mediaId]/retry` |
| Update metadata | `PATCH /api/admin/media/[mediaId]` |
| Archive | `POST /api/admin/media/[mediaId]/archive` |
| Restore | `POST /api/admin/media/[mediaId]/restore` |

## Policies

- Optimistic concurrency via `expectedRevision` on every mutation.
- **Archive instead of delete** — blocked while media is referenced by articles (working or published snapshots), videos, or incomplete usage scan.
- **Ready binary immutable** — cannot replace file on same asset; upload new media and update references.
- Metadata edit forbidden while `uploading`.
- Admin DTOs never include `storageKey`, bucket name, or credentials.

## Article integration

- Draft saves may reference uploading/failed media.
- **Publish** requires every referenced `mediaId` to exist, `status: ready`, and matching kind (`image` for cover/image/gallery/poster; `document` for file blocks).
- Video blocks: `mediaId` for video file rejected; use `videoId` or remove.

## List pagination

Server-side `listAdmin` with cursor, deterministic sort (`updatedAt_desc` + id tie-break), optional status/kind filters, bounded title/filename search (`scanLimitExceeded` when capped).

## Out of scope

Video admin, audio upload, CDN URLs, image editing, physical delete, Google Drive media import.

## See also

- ADR 0011
- [MEDIA-MODEL.md](../data-model/MEDIA-MODEL.md)
- [MEDIA-STORAGE.md](../infrastructure/MEDIA-STORAGE.md)
- [ARTICLE-PUBLISHING.md](./ARTICLE-PUBLISHING.md)
