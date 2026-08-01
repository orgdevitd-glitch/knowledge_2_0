# Admin: Google integrations (Phase 6A)

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/integrations` | Hub (Google Workspace status) |
| `/admin/integrations/google` | Connection status, test, recent imports |
| `/admin/integrations/google/sources` | Source list |
| `/admin/integrations/google/sources/new` | URL/ID + Drive browser |
| `/admin/integrations/google/sources/[sourceId]` | Source detail / actions |
| `/admin/integrations/google/imports` | Import jobs |
| `/admin/integrations/google/imports/[importJobId]` | Preview, diff, confirm/cancel |

When `GOOGLE_WORKSPACE_MODE=disabled`, pages show a safe unavailable state and do not call Google APIs.

## Implemented vs deferred

**Implemented:** service-account ADC, read-only scopes, Shared Drive + root boundary, Drive browser, Docs→Article draft, Sheets→Prompt drafts, preview TTL, structural diff, ready-only Sheets mode, idempotency, audit.

**Deferred (Phase 6B+):** automatic sync, changes feed, Scheduler, write-back, media import, Picker, full Prompt editor.

## Automated coverage

- Unit: URL parser, boundary, Docs/Sheets mappers, preview/confirm, architecture boundaries
- Firestore emulator: articles, prompts, sourceConnections, importJobs, idempotency
- Rules: deny-all client access

## Real Shared Drive acceptance checklist (open)

1. Service account has access only to the target Shared Drive / root folder
2. Root opens; cannot navigate above root
3. Outside-root file denied
4. Docs preview shows warnings for images
5. Confirm creates Article draft; repeated confirm does not duplicate
6. Changing Docs after preview blocks confirm
7. Sheets preview shows row errors; ready-only works
8. Prompt drafts are not public
9. No Google token in browser storage / client chunks
10. Client bundle has no `googleapis` / service credentials
