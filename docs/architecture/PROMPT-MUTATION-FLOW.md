# Prompt mutation flow (Phase 8A)

```text
Admin UI
  → adminPromptsApi (CSRF fetch)
  → /api/admin/prompts/*
  → Origin + Content-Type + rate limit + CSRF
  → requireAdminPrincipalForApi
  → Zod body
  → prompt use case (actorId from principal)
  → Firestore / memory repositories
  → AuditEvent
  → PublicContentInvalidationPort (publish / hide / archive)
  → safe DTO JSON
```

Page reads use `requireAdminPrincipal()` (redirect). Mutations use JSON 401/403.

Middleware is not the security boundary.

## Endpoints

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/api/admin/prompts` | `createPromptUseCase` |
| `PATCH` | `/api/admin/prompts/[promptId]` | `updatePrompt` |
| `POST` | `.../publish` | `publishPrompt` → `runAtomicPromptPublish` |
| `POST` | `.../hide` | `hidePrompt` |
| `POST` | `.../archive` | `archivePrompt` |
| `POST` | `.../restore` | `restoreArchivedPrompt` |
| `POST` | `.../versions/[versionId]/restore` | `restorePromptVersion` |

All mutating bodies require `csrfToken` + `expectedRevision` (create uses `expectedRevision: 0` implicitly via repository create path).

## Atomic mutations

All Prompt mutations use `persistPromptMutation` → `UnitOfWork.runAtomicPromptMutation` (publish also via `runAtomicPromptPublish`):

1. Verifies `expectedRevision` / slug uniqueness
2. Writes Prompt (+ ContentVersion on publish) + AuditEvent in one transaction
3. On failure, no partial Prompt/version/audit remains (Firestore transaction; Memory UoW rolls back)

`publishPrompt` builds immutable `ContentVersion` from `toPromptSnapshot(existing)` then `markPromptPublished` (entity `Prompt.source` preserved).

Public invalidation runs only after successful commit in API routes.

## Invalidation

- `publish`, `hide`, `archive` call `PublicContentInvalidationPort.invalidatePrompt({ slug })`.
- Save-only edits do not invalidate public routes until publish.

## See also

- [ADMIN-MUTATION-FLOW.md](./ADMIN-MUTATION-FLOW.md)
- [../admin/PROMPT-LIFECYCLE.md](../admin/PROMPT-LIFECYCLE.md)
- ADR 0010
