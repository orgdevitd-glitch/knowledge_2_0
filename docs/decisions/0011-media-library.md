# ADR 0011 — Media Library (Phase 7B)

## Status

Accepted

## Context

Articles and blocks reference `MediaId` pointers for cover images, inline images, galleries, file attachments, and video posters. Phase 5B–8A allowed draft editing with unresolved media placeholders; publish validation blocked missing media. Administrators had no CMS path to upload, validate, and deliver binaries.

Phase 7B adds a **Media Library** for **images and documents only**. Video/audio binary upload, CDN delivery, antivirus scanning, and orphaned-object sweepers are out of scope.

## Decision

### Scope

- Admin UI under `/admin/media/**` and mutation APIs under `/api/admin/media/**`.
- Public delivery via same-origin `GET /media/[mediaId]` (ready assets only).
- Article publish validates referenced media is `ready` with compatible `kind` (draft saves are not blocked).

### Storage

- **Private GCS bucket** in production (`MEDIA_STORAGE_MODE=gcs` required; no silent memory fallback).
- **memory** adapter for tests and local development only (forbidden in production).
- **Firebase Storage client SDK denied** (`storage.rules`: deny all read/write).
- All object access through **Admin SDK** + `MediaStoragePort`.
- `storageKey` is server-generated (`media/{mediaId}/{random}`); never derived from user filenames.
- Production bucket CORS must allow explicit portal origin(s) + `PUT` + required headers (not replaced by Storage Rules).

### Upload flow

1. `startMediaUpload` — mint **signed PUT URL** first, then atomically create `MediaAsset` (`uploading`) + `media.created` + `media.upload.started`. Unused capabilities expire safely.
2. Client uploads bytes with `requiredHeaders` (GCS: `Content-Type: application/octet-stream`, `x-goog-if-generation-match: 0`). Memory mode uses upload-proxy with one-time tokens.
3. `completeMediaUpload` — stat object, read prefix, **sniff MIME**, enforce size/kind/extension match, mark `ready` or `failed`. Idempotent for already-ready assets with matching provider generation.
4. `reissueMediaUploadUrl` — **uploading only**; same `storageKey`, new signed URL.
5. `retryMediaUpload` — **failed only**; allocates **new storageKey**; old object best-effort deleted.

Object size is enforced at declared-size (start) and actual-size (complete). Signed URLs do **not** encode a content-length range in Phase 7B.

### Ready binary is immutable

- Once `status === ready`, bytes cannot be replaced on the same `MediaAsset`.
- `assertMediaBinaryImmutable` blocks retry/replace on ready media.
- To change binary content, create a **new** `MediaAsset` and update content references.
- No `media.file.replaced` audit event.

### Allowed content

| Kind | MIME types | Extensions |
|------|------------|------------|
| `image` | `image/jpeg`, `image/png`, `image/webp` | jpg, jpeg, png, webp |
| `document` | `application/pdf`, `text/plain`, `text/csv` | pdf, txt, csv |

- Magic-byte sniff for binaries; text types require mostly-text prefix (reject binary disguised as text).
- **No video/audio** upload in Phase 7B; article video blocks must use `videoId` or external URL (not `mediaId` for video binary).

### Lifecycle

Statuses: `uploading` → `ready` | `failed`; `ready` | `failed` → `archived`; `archived` → `ready` | `failed` (restore validates object integrity).

- **Archive, not physical delete** — metadata status + audit; GCS objects retained.
- Archive blocked when bounded usage scan finds references (`MEDIA_IN_USE`).
- Restore from archive re-validates generation/checksum/size when recorded.

### Delivery

- Public route uses `openObjectStream` (GCS `createReadStream`; no full-object download on the delivery path) with `Content-Type` from stored `mimeType`, `X-Content-Type-Options: nosniff`, short private cache.
- Images: `Content-Disposition: inline`; documents: `attachment`.
- Range requests are not supported.
- Admin DTOs expose `publicPath: /media/{id}` when deliverable; never expose `storageKey`, bucket, or signed URLs in list/detail DTOs.
- `providerChecksum` is provider CRC32C metadata, not application SHA-256.

### Security & audit

- All mutations: session + CSRF + rate limit + `runAdminMutation` + optimistic `expectedRevision`.
- Audit events: `media.created`, `media.upload.started`, `media.upload.completed`, `media.upload.failed`, `media.metadata.updated`, `media.archived`, `media.restored`.
- Metadata (title, description, default alt) editable when not `uploading`.

## Consequences

### Positive

- Centralized, validated media with clear publish gates.
- No client direct bucket access; sniffing reduces MIME spoofing.
- Immutable ready binaries simplify caching and published snapshots.

### Negative / deferred

- No video/audio admin, image transforms, CDN, range requests, or orphan sweeper.
- Usage scan is bounded; incomplete scan blocks archive (`MEDIA_USAGE_SCAN_INCOMPLETE`).
- Public delivery reads full object into memory (acceptable for Phase 7B size limits).

## Related docs

- [MEDIA-ADMIN.md](../admin/MEDIA-ADMIN.md)
- [MEDIA-MODEL.md](../data-model/MEDIA-MODEL.md)
- [MEDIA-STORAGE.md](../infrastructure/MEDIA-STORAGE.md)
- [MEDIA-MUTATION-FLOW.md](../architecture/MEDIA-MUTATION-FLOW.md)

## Out of scope (unchanged)

Video admin, automatic Google sync (6B), CDN, antivirus, physical delete, WYSIWYG, new UI libraries.
