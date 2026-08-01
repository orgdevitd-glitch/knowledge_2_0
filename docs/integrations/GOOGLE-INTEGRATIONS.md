# Google Integrations (Phase 6A)

Google Drive, Docs and Sheets are **external preparation sources**. The portal database remains the source of truth for published content.

## Phase 6A scope (implemented)

Manual, preview-first import only:

1. Admin adds a SourceConnection (URL/ID or Drive browser within allowed root)
2. Server validates Shared Drive + root boundary
3. Preview creates an `ImportJob` (TTL) without mutating Articles/Prompts
4. Administrator confirms
5. Portal creates or updates **draft** materials
6. Publication remains a separate manual step

**Not in Phase 6A:** Cloud Scheduler, Drive changes feed, webhooks, automatic import/publish, Google write APIs, media download, Google Picker, bidirectional sync.

## Canonical pipeline

```text
src/server/google-workspace/          # ports, ADC auth, adapters, boundary, URL parser
src/features/integrations/google/
  docs/map-google-doc-to-draft.ts     # Docs → ArticleImportDraft
  sheets/parse-prompt-sheet.ts        # Sheets → PromptImportItem[]
  application/create-import-preview.ts
  application/confirm-import.ts
src/app/admin/integrations/**         # admin UI
src/app/api/admin/integrations/google/**  # admin API
```

## Admin routes

- `/admin/integrations`
- `/admin/integrations/google`
- `/admin/integrations/google/sources`
- `/admin/integrations/google/sources/new`
- `/admin/integrations/google/sources/[sourceId]`
- `/admin/integrations/google/imports`
- `/admin/integrations/google/imports/[importJobId]`

## API endpoints

- `GET /api/admin/integrations/google/status`
- `POST /api/admin/integrations/google/test`
- `GET /api/admin/integrations/google/drive/folders/[folderId]`
- `POST /api/admin/integrations/google/sources`
- `GET /api/admin/integrations/google/sources/[sourceId]`
- `POST .../test` · `POST .../preview` · `POST .../archive`
- `POST /api/admin/integrations/google/imports/[importJobId]/confirm`
- `POST /api/admin/integrations/google/imports/[importJobId]/cancel`

Mutations require admin session, CSRF, Origin, Zod, rate limits, safe errors, audit.

## Manual Shared Drive acceptance

Open until real credentials are available. Checklist: `docs/admin/GOOGLE-INTEGRATIONS.md`.
