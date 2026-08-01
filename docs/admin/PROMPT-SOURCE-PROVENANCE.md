# Prompt source provenance (Phase 8A)

## Two concepts

| Concept | Where | Meaning |
|---------|--------|---------|
| **Entity provenance** | `Prompt.source` (`SourceReference`) | Origin of the Prompt: manual/portal or Google Sheets import (`externalId`, `connectionId`, `lastImportJobId`, sync timestamps). Survives edit, publish, republish, hide, archive, restore, and version restore. |
| **Version creation reason** | `ContentVersion.source` | Why that immutable version was created (portal publish → `portalSource()`). Not a wipe of entity provenance. `PromptSnapshot` does not carry import fields. |

Manual prompts use `type: portal` (or `manual-import`) without inventing a SourceConnection.

## SourceReference fields (admin only)

| Field | Purpose |
|-------|---------|
| `type` | `portal` \| `google-docs` \| `google-sheets` \| `google-drive` \| `manual-import` |
| `externalId` | Row id from Sheets (`external_id` column) |
| `connectionId` | SourceConnection id — scopes externalId uniqueness |
| `lastImportJobId` | Last confirmed ImportJob |
| `externalUrl` | Optional HTTPS link |
| `lastKnownModifiedAt`, `lastSyncAt`, `checksum` | Import/sync metadata |

Admin detail shows a safe summary (`PromptSourceSummary`): origin, connection, externalId, last ImportJob / date, connection status, warnings for `access-lost` / `archived`. Never credentials, tokens, raw Google payloads, or Firestore paths.

## Google Sheets import

- Confirm creates or updates **draft** prompts with `source.type = google-sheets`, `connectionId`, `externalId`, `lastImportJobId`.
- Matching uses `findBySourceExternalId({ sourceType, connectionId, externalId })` — not a truncated admin list.
- Same `externalId` in two SourceConnections does not collide.
- Duplicate `external_id` within one sheet batch is rejected at parse time.
- Import never auto-publishes; status column from Sheets is ignored.
- Import-managed `externalId` / `connectionId` cannot be silently rewritten by admin draft updates.

## Lifecycle

`markPromptPublished` **preserves** `Prompt.source`. Publish does not replace Sheets provenance with `portal`.

Version restore applies content snapshot fields only; entity `SourceReference` stays.

## Public boundary

Public DTOs / catalog / search summaries never expose `SourceReference`, connection ids, ImportJob ids, checksums, or credentials.

Audit metadata may include `sourceType` and `hasExternalId` only — never full source payload or `promptText`.

## ImportJob history

- Preview payload is an immutable snapshot (`expiresAt` TTL).
- Confirm records `confirmedAt`, `confirmedBy`, and result entity ids.
- Old ImportJob previews are not rewritten when taxonomy or portal prompts change.
- Re-import confirm uses current target `revision`.

## See also

- [../integrations/GOOGLE-SHEETS-IMPORT.md](../integrations/GOOGLE-SHEETS-IMPORT.md)
- [PROMPT-ADMIN.md](./PROMPT-ADMIN.md)
- ADR 0010
