# ADR 0008: Google Workspace manual import (Phase 6A)

## Status

Accepted

## Context

The corporate knowledge portal needs Google Docs and Google Sheets as **preparation sources** for administrators. Published content must remain owned by the portal database. Phase 6A delivers manual, preview-first import only. Automatic sync (Phase 6B), media library, and bidirectional write-back are out of scope.

## Decision

### Authentication

- Use a **server technical identity** via Application Default Credentials (Cloud Run service account in production; developer ADC locally).
- Do **not** use Firebase ID tokens, user Drive OAuth, domain-wide delegation, or browser-held Google tokens.
- Mode: `GOOGLE_WORKSPACE_MODE=disabled|service-account`.
- When `disabled`, public and admin article flows continue; Google clients are not initialized.

### Scopes (read-only)

- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/documents.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`

### Client library

- Official `googleapis` on the server only.
- Domain/UI never import `googleapis` types; adapters map to local DTOs.

### Boundary

- Work only inside the configured Shared Drive.
- Additionally enforce `GOOGLE_WORKSPACE_ROOT_FOLDER_ID` (and optional allowed folder IDs) via parent-chain policy with depth/cycle guards.

### Entities

- `SourceConnection` — metadata about an allowed Google file (no tokens, no raw API payloads).
- `ImportJob` — preview-first job with TTL (`expiresAt`), warnings/errors, and confirm/cancel lifecycle.

### Workflow

```text
Google Workspace → server adapters → validation → normalize → preview → admin confirm → draft use cases → manual publish later
```

- Docs → `ArticleImportDraft` → create/update **draft** Article (or working draft of published Article without touching `publishedVersion`).
- Sheets → Prompt sheet schema v1 → Prompt **drafts** only.
- Idempotency via hashed keys in `idempotencyRecords`.
- Conflicts: source version change / target revision change abort confirm.

### Explicit non-goals (Phase 6B+)

- Cloud Scheduler, Drive changes feed, webhooks, auto import/publish
- Docs/Sheets/Drive write APIs
- Google Picker, media download, PDF/DOCX/XLSX import

## Consequences

- Administrators must explicitly confirm every import.
- Public readers never see Google-sourced drafts until portal publication.
- Multi-instance rate limiting remains in-process (documented limitation from Phase 5).
- Real Shared Drive manual acceptance remains open until corporate credentials are configured; automated fake-adapter coverage is required for Phase 6A gate.
