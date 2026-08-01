# Admin session cookie (Phase 5A)

## Purpose

Server-side Firebase **session cookie** is the only credential that grants admin UI access. Presence of a cookie without server verification grants nothing.

## Cookie attributes

| Attribute | Value |
|-----------|--------|
| HttpOnly | yes |
| Secure | yes in production |
| SameSite | `Lax` |
| Path | `/` |
| Domain | omitted |
| Max-Age | configurable; default **8 hours**; project max **5 days** |

### Names

- Production default: `__Host-ckp_admin_session` (requires Secure + Path=/ + no Domain)
- Local HTTP default: `ckp_admin_session`
- Override via `ADMIN_SESSION_COOKIE_NAME`

## Verification (every protected server request)

1. Read cookie
2. Verify signature / expiry via Firebase Admin (`checkRevoked`)
3. Re-apply allowlist access policy
4. Return typed `AdminPrincipal` (`uid`, `email`, `displayName`, `role`, `sessionIssuedAt`)

Full Firebase decoded tokens are not passed to the UI. `/api/auth/me` returns only safe fields (`email`, `displayName`, `role`).

## Logout

`DELETE /api/auth/session` clears the cookie (CSRF + Origin required). Idempotent. Global refresh-token revocation is deferred to a later admin function.
