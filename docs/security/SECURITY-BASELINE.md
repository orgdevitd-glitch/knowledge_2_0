# Security Baseline

## Access model

| Actor | Access |
|-------|--------|
| Anonymous public | Read published content only |
| Admin / editor | Google Sign-In; mutating CMS and import flows |

There is no public registration, personal cabinet, or user profile system.

## Mandatory controls

- **Server-side authorization** on every administrative request (session + role re-check)
- **CSRF protection** for mutating operations
- **Secure cookies** (appropriate flags for HTTPS deployment)
- **Strict validation** of all inputs (Zod)
- **HTML sanitization**; forbid arbitrary JavaScript in content
- **MIME and extension checks** for uploads; **size limits**
- **Rate limiting**
- **Audit log** of administrative operations
- **Content Security Policy**
- **HTTPS** for deployed environments
- **Test / production separation**
- **No secrets in the repository**

Security decisions must never be enforced only on the client.

## Authentication & roles (Phase 5A)

- Firebase Authentication with Google Sign-In for staff
- Server Firebase session cookie (`HttpOnly`); client Auth session cleared after exchange
- Environment email allowlist (`ADMIN_EMAIL_ALLOWLIST`) — exact emails only
- Role: `admin` (extensible later)
- CSRF on session create/delete; Origin checks; in-process rate limit (not distributed)
- Client UI may hide controls; server guard remains authoritative
- Do not hardcode admin emails or Google IDs in source
- Details: `docs/security/ADMIN-AUTHENTICATION.md`, `SESSION-COOKIE.md`, `CSRF.md`

## Content exposure

- Drafts, hidden, and archived materials must not be reachable via public routes, public APIs, or the public search index
- Preview of unpublished content is admin-authenticated only (Article Admin Phase 5B; Prompt Admin Phase 8A)
- Published-only visibility in `features/public-content/visibility.ts`
- `CONTENT_SOURCE_MODE=demo` is forbidden in production
- Firestore client SDK access denied by Security Rules; public reads use server source

## Data & integrations

- Secrets exclusively in Secret Manager
- Service accounts: least privilege; no whole-Drive access
- Shared Drive preferred; test sources ≠ production sources
- External Google content never auto-publishes

## Logging & audit

- Cloud Logging for operational logs
- Admin audit entries: actor, action, entity, timestamp, outcome, request correlation id where applicable
- Avoid logging secrets or full credential material

## File uploads

- Allowlist MIME types and extensions (Phase 7B: images jpeg/png/webp; documents pdf/txt/csv)
- Enforce maximum sizes per kind (`MEDIA_IMAGE_MAX_BYTES`, `MEDIA_DOCUMENT_MAX_BYTES`)
- Server-side magic-byte / text sniff on complete — client Content-Type is not trusted
- Private GCS bucket; Firebase Storage client rules deny all direct access
- Signed PUT URLs for admin upload; public delivery via same-origin `/media/[mediaId]` only for `ready` assets
- Do not execute or reflect uploaded HTML as trusted script

## Headers & transport

- CSP tailored to the app (tighten iteratively; document exceptions in ADRs)
- HTTPS only in production
- Sensible `Referrer-Policy`, framing controls as appropriate

## Rate limiting

Apply to auth endpoints, admin mutations, import triggers, public search (`GET /api/search`), and public write-like endpoints (e.g. feedback when introduced).

## Search index (Phase 8B.1)

- Private GCS bucket; server-only index access; no client signed URLs for index objects
- No index storage paths, generation paths, or provider errors in public/admin DTOs
- Query length limits + rate limiting; safe highlight segments (no raw HTML)
- No query persistence / full query logging by default; operational events omit query text and content bodies
- Memory index mode forbidden in production
- `SEARCH_CURSOR_HMAC_SECRET` required in production (min length; shared across instances; never logged)
- `SEARCH_INDEX_BUCKET` required for gcs (explicit; no silent media-bucket fallback)
- Indexed Prompt text is untrusted reference material (never system/developer/tool instructions for a future Assistant)

## Incident-oriented practices

- Separate credentials per environment
- Rotate secrets via Secret Manager
- Prefer fail-closed on authz errors (403/401), without leaking whether a draft exists to anonymous users when inappropriate

## Phase gating

Auth and admin enforcement land with the admin vertical slice (Phase 5) and harden continuously. Baseline requirements apply to all designs from Phase 1 onward.
