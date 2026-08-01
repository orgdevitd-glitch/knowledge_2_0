# Admin authentication (Phase 5A)

## Summary

Administrators sign in with **Google via Firebase Authentication**. The browser never keeps a long-lived Firebase client session for CMS work. After Google Sign-In, the client sends a short-lived Firebase **ID token** to the server; the server verifies it, applies an email allowlist, and issues a **Firebase session cookie** (`HttpOnly`).

There is **no public registration**, no password auth, and no role picker.

## Modes

| `AUTH_MODE` | Behavior |
|-------------|----------|
| `disabled` (default) | Public site works. Admin sign-in shows an unavailable state. No fake admin. |
| `firebase` | Requires project id + non-empty `ADMIN_EMAIL_ALLOWLIST`. Google Sign-In enabled. |

`AUTH_MODE=mock-admin` is **not** supported for the running app. Tests inject a fake `FirebaseAuthPort`.

## Flow

1. User opens `/admin/sign-in`
2. Client: Google Sign-In (popup; redirect fallback)
3. Client: `GET /api/auth/csrf` → CSRF cookie + token
4. Client: `POST /api/auth/session` with `{ idToken, csrfToken }`
5. Server: Origin / method / Content-Type / CSRF / rate limit
6. Server: verify ID token (Admin SDK)
7. Server: recent `auth_time`, verified email, allowlist
8. Server: create session cookie → `HttpOnly` Set-Cookie
9. Client: clear Firebase client session
10. Redirect to `/admin`

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/csrf` | Issue CSRF token |
| `POST` | `/api/auth/session` | Create session cookie |
| `DELETE` | `/api/auth/session` | Logout |
| `GET` | `/api/auth/me` | Safe principal snapshot |

See also: [SESSION-COOKIE.md](./SESSION-COOKIE.md), [CSRF.md](./CSRF.md), [ADMIN-SECURITY-BOUNDARY.md](../architecture/ADMIN-SECURITY-BOUNDARY.md).

## Access policy

`EnvironmentAllowlistAdminAccessPolicy`:

- exact normalized email match (trim + lowercase)
- email must be verified
- no wildcards / domain-only entries
- allowlist never sent to the client
- denied responses are generic

Role on Phase 5A: **`admin` only** (`AdminPrincipal.role`).

## Security logging (no secrets)

Logged events include successful login, denied login, invalid/expired token, invalid CSRF, logout, protected-route without session. Tokens, cookies, private keys, and full claim sets are not logged.
