# Media Storage (Phase 7B)

Binary media lives in **private object storage**, separate from Firestore metadata.

## Modes

| `MEDIA_STORAGE_MODE` | Adapter | Use |
|----------------------|---------|-----|
| `gcs` | `GcsMediaStorageAdapter` | Production / staging (requires bucket) |
| `memory` | `MemoryMediaStorage` | Tests and local development only |

### Fail-closed production rules

- `MEDIA_STORAGE_MODE` is **required** in production and must be `gcs`.
- `MEDIA_STORAGE_MODE=memory` is **forbidden** in production (no silent fallback).
- Unknown mode values are rejected in every environment.
- `gcs` without `MEDIA_GCS_BUCKET` / `FIREBASE_STORAGE_BUCKET` fails fast.
- Non-production default when unset: `memory` in test, when persistence is memory, or when no bucket is configured; otherwise `gcs`.

Configuration: `getMediaLimits()` in `src/config/media-env.ts` (bucket, TTL bounds, size ceilings, sniff prefix length).

TTL and size env overrides are bounded (`MEDIA_ENV_BOUNDS`). Credentials are never read from `NEXT_PUBLIC_*` variables.

## GCS layout

- Bucket: `MEDIA_GCS_BUCKET` or `FIREBASE_STORAGE_BUCKET`.
- Object key: `media/{mediaId}/{randomHex}` — generated server-side; **not** from user filename.
- Bucket is **private**; no public object ACLs.

## Access paths

| Actor | Access |
|-------|--------|
| Browser / Firebase client SDK | **Denied** (`storage.rules`) |
| Admin upload | Signed PUT URL from `MediaStoragePort.createSignedUploadUrl` |
| Server complete / delivery / restore | Admin SDK via `MediaStoragePort` |

## Signed upload security contract

Signed upload capability:

- allows **PUT / write** only
- is bound to one exact `storageKey`
- has a short bounded TTL (`MEDIA_SIGNED_UPLOAD_TTL_SECONDS`, clamped)
- expects `Content-Type: application/octet-stream`
- uses `x-goog-if-generation-match: 0` to refuse overwriting an existing object
- must not be logged, stored in Firestore, or returned from admin detail/list DTOs
- is returned only from start / retry / reissue responses

### Size enforcement (honest)

GCS signed PUT URLs in this phase **do not** encode a content-length range constraint in the URL.

Instead:

1. Declared size is validated before issuing the URL.
2. Actual object size is validated at `complete`.
3. Oversized objects mark the asset `failed` and the object is deleted best-effort.
4. Production monitoring should track oversized orphan objects if delete fails.

## Bucket CORS (production required)

Browser direct PUT to the private bucket requires **bucket CORS** configured at the infrastructure level. Storage Rules do **not** replace CORS. The signed URL remains a bearer capability.

Minimum production CORS:

- allowed origin(s): **explicit portal origin(s) only** (no `*` in production)
- allowed method: `PUT`
- allowed request header: `Content-Type` (and any signed extension headers the client must send, e.g. `x-goog-if-generation-match`)
- max age: short operational value

Do not hard-code company domains in application source.

## Upload contract

1. Server mints signed upload URL for a new `storageKey`.
2. Atomically writes `MediaAsset` (`uploading`) + `media.created` + `media.upload.started`.
3. Client PUTs raw bytes (with `requiredHeaders` from the start response).
4. Server `completeMediaUpload`: `stat` → `readPrefix` → sniff → `ready` or `failed` + best-effort delete.
5. If the start URL expires while still `uploading`, call `reissue-upload` (same `storageKey`).
6. If status is `failed`, `retry` mints a **new** `storageKey` (ready binaries are immutable).

Signed URL TTL: `MEDIA_SIGNED_UPLOAD_TTL_SECONDS` (default 15 minutes, bounds 60–3600).

## Size limits

| Kind | Env override | Default | Absolute env bound |
|------|--------------|---------|--------------------|
| `image` | `MEDIA_IMAGE_MAX_BYTES` | 5 MiB | 1 KiB … 20 MiB |
| `document` | `MEDIA_DOCUMENT_MAX_BYTES` | 15 MiB | 1 KiB … 50 MiB |

## Public delivery

Not served from a public GCS URL. Application route `GET /media/[mediaId]`:

- streams via `openObjectStream` (GCS uses `createReadStream`; no full-object Buffer download on the delivery path)
- only `ready` assets
- `Content-Type` from server-confirmed metadata
- images: `Content-Disposition: inline`
- documents: `Content-Disposition: attachment`
- `X-Content-Type-Options: nosniff`
- conservative `Cache-Control`
- Range requests are **not** supported

## Memory adapter (dev/test)

- One-time, short-lived, cryptographically random tokens bound to one `storageKey`, `PUT`, and `maxBytes`.
- Upload-proxy route bridges browser → memory store in memory mode only.
- Forbidden in production.

## Production checklist

1. Provision private GCS / Firebase Storage bucket (not public).
2. Configure IAM for the Admin SDK service account (object admin / signer as required).
3. Apply bucket CORS for the portal origin(s) + `PUT` + required headers.
4. Set production env: `MEDIA_STORAGE_MODE=gcs`, bucket name, TTL, size limits.
5. Deploy Firestore indexes for media admin queries.
6. Deploy `storage.rules` (deny-all client).
7. Monitor orphan / oversized objects after failed completes (no background sweeper in Phase 7B).

## Deferred

CDN, signed read URLs for public, multipart upload UI, background orphan sweeper, virus scanning, antivirus, OCR, video/audio upload.

## See also

- ADR 0011
- [MEDIA-MODEL.md](../data-model/MEDIA-MODEL.md)
- [ENVIRONMENT.md](../config/ENVIRONMENT.md)
