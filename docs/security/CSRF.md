# CSRF protection (Phase 5A)

## Scope

CSRF applies at minimum to:

- `POST /api/auth/session` (create session)
- `DELETE /api/auth/session` (logout)

## Token design

- Cryptographically random payload
- HMAC signature (server-derived material)
- Bound via readable CSRF cookie + matching body/header value
- Compared with **constant-time** equality
- TTL ≈ 2 hours
- Rotated after successful login
- Not a session token; may be readable by JavaScript
- Not logged in full

Cookie name: `CSRF_COOKIE_NAME` (default `ckp_csrf`), `HttpOnly=false`, `SameSite=Lax`, `Secure` in production.

## Additional checks

CSRF alone is insufficient. Handlers also verify:

- `Origin` against allowed hosts (`SITE_URL` + localhost in non-prod)
- HTTP method
- `Content-Type` for JSON bodies
- body size limits
- in-process rate limiting (see limitations below)

## Rate limiting

Phase 5A uses an **in-process** limiter suitable for a single instance (dev/tests). On multi-instance Cloud Run this is **not** distributed protection — document the port for a future shared limiter; do not claim full distributed coverage.

## Phase 5B admin mutations

All `/api/admin/articles*` mutating handlers use the same CSRF double-submit pattern via `runAdminMutation` (Origin + Content-Type + rate limit + CSRF + `requireAdminPrincipalForApi`).
