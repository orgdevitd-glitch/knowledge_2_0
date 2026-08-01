# Admin mutation flow (Phase 5B)

```text
Admin UI
  → adminArticlesApi (CSRF fetch)
  → /api/admin/articles/*
  → Origin + Content-Type + rate limit + CSRF
  → requireAdminPrincipalForApi
  → Zod body
  → article use case (actorId from principal)
  → Firestore / memory repositories
  → AuditEvent
  → PublicContentInvalidationPort (when public visibility changes)
```

Page reads use `requireAdminPrincipal()` (redirect). Mutations use JSON 401/403.

Middleware is not the security boundary.
