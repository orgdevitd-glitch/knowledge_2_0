# Admin security boundary (Phase 5A)

## Boundary

| Layer | Responsibility |
|-------|----------------|
| Browser | Google Sign-In UI only; no Admin SDK; no Firestore client access |
| Route Handlers `/api/auth/*` | CSRF, Origin, rate limit, session create/delete |
| Server Components / guards | `requireAdminPrincipal()` on every protected page |
| Admin SDK | Auth session verification + Firestore I/O |
| Security Rules | Deny all client SDK access (defense in depth) |

Middleware may optimize navigation redirects but is **not** the security boundary. Mutation handlers must call the guard again.

## Principal

```text
AdminPrincipal
  uid
  email
  displayName
  role          # "admin" in Phase 5A
  sessionIssuedAt
```

## Protected routes

- `/admin` — shell / infra status
- `/admin/articles` — read-only article list
- `/admin/sign-in` — public to unauthenticated; redirects if already signed in

## Composition modes

| Mode | Production rule |
|------|-----------------|
| `AUTH_MODE=disabled` | Safe; no bypass |
| `AUTH_MODE=firebase` | Full checks |
| `PERSISTENCE_MODE=memory` | Forbidden in production |
| `CONTENT_SOURCE_MODE=demo` | Forbidden in production |
| `CONTENT_SOURCE_MODE=firestore` | Server-only public read |

See ADR 0006.
