# Taxonomy mutation flow

```text
Browser form
  → CSRF + Origin + Content-Type
  → rate limiter (create/update/move/reorder/archive/restore buckets)
  → requireAdminPrincipalForApi
  → Zod body
  → application use case (revision check)
  → Firestore/memory repository save
  → AuditEvent
  → PublicContentInvalidationPort.invalidateCatalogs()
  → safe DTO JSON
```

Actor id always comes from the server session, never from the client body.

## Endpoints

### Categories

- `POST /api/admin/taxonomy/categories`
- `PATCH /api/admin/taxonomy/categories/[categoryId]`
- `POST .../move`
- `POST .../reorder`
- `POST .../archive`
- `POST .../restore`

### Tags

- `POST /api/admin/taxonomy/tags`
- `PATCH /api/admin/taxonomy/tags/[tagId]`
- `POST .../archive`
- `POST .../restore`

### Audiences

- `POST /api/admin/taxonomy/audiences`
- `PATCH /api/admin/taxonomy/audiences/[audienceId]`
- `POST .../reorder`
- `POST .../archive`
- `POST .../restore`

### Usage (read)

- `GET /api/admin/taxonomy/[taxonomyType]/[taxonomyId]/usage`
