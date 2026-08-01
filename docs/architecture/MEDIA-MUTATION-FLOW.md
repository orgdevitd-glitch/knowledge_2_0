# Media mutation flow

```text
Browser (admin)
  → CSRF + Origin + Content-Type
  → rate limiter (upload / complete / metadata / archive buckets)
  → requireAdminPrincipalForApi
  → Zod body
  → media use case (revision check)
  → UnitOfWork.runAtomicMediaMutation (entity + audit(s))
  → safe AdminMediaDto JSON
```

Actor id from server session only.

## Upload pipeline

```text
POST /api/admin/media/uploads
  → startMediaUpload
  → createSignedUploadUrl (capability first; unused URL expires safely)
  → atomic MediaAsset(uploading) + media.created + media.upload.started
  → { media, uploadUrl, expiresAt, requiredHeaders }

Client PUT uploadUrl (bytes + requiredHeaders)

POST /api/admin/media/[mediaId]/complete
  → completeMediaUpload (idempotent if already ready + same generation)
  → stat + readPrefix + sniffMediaContent
  → markMediaReady | markMediaUploadFailed
  → audit media.upload.completed | media.upload.failed

POST /api/admin/media/[mediaId]/reissue-upload
  → reissueMediaUploadUrl (uploading only, same storageKey)

POST /api/admin/media/[mediaId]/retry
  → retryMediaUpload (failed only, new storageKey)
```

## Endpoints

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/api/admin/media/uploads` | `startMediaUpload` |
| `POST` | `/api/admin/media/[mediaId]/complete` | `completeMediaUpload` |
| `POST` | `/api/admin/media/[mediaId]/reissue-upload` | `reissueMediaUploadUrl` |
| `POST` | `/api/admin/media/[mediaId]/retry` | `retryMediaUpload` |
| `PATCH` | `/api/admin/media/[mediaId]` | `updateMediaMetadata` |
| `POST` | `/api/admin/media/[mediaId]/archive` | `archiveMedia` |
| `POST` | `/api/admin/media/[mediaId]/restore` | `restoreMedia` |
| `PUT` | `/api/admin/media/upload-proxy` | Memory-mode upload bridge (dev/test) |

## Public read (non-admin)

```text
GET /media/[mediaId]
  → getContentPorts().media.getById
  → isPubliclyDeliverable (status ready)
  → mediaStorage.openObjectStream
  → stream with nosniff + disposition
```

No authentication; non-ready assets return 404. Range requests are not supported.

## Atomicity

`persistMediaMutation` → `runAtomicMediaMutation`: single transaction for `mediaAssets` save + **one or more** `auditEvents`. Start upload writes `media.created` and `media.upload.started` together.

Binary storage is outside the Firestore transaction (compensating behavior documented in ADR 0011).

## Article publish gate

`publishArticle` dynamically imports `assertArticleMediaReadyForPublish` — validates cover and block media references before version snapshot. Draft saves are not blocked by non-ready media.

## Audit event types

`media.created`, `media.upload.started`, `media.upload.completed`, `media.upload.failed`, `media.metadata.updated`, `media.archived`, `media.restored`.

No `media.file.replaced` — ready binaries are immutable.

## See also

- [ADMIN-MUTATION-FLOW.md](./ADMIN-MUTATION-FLOW.md)
- [MEDIA-ADMIN.md](../admin/MEDIA-ADMIN.md)
- ADR 0011
