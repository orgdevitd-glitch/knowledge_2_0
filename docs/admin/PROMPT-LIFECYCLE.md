# Prompt lifecycle (Phase 8A)

## Statuses

`draft` | `published` | `hidden` | `archived`

Same transition matrix as Article (see `src/domain/shared/status.ts`).

## Flow

1. Admin confirms publish with optional `changeSummary`.
2. `POST /api/admin/prompts/[promptId]/publish` with CSRF + `expectedRevision`.
3. `assertPromptPublishable` then `publishPrompt` use case.
4. Firestore: `runAtomicPromptPublish` writes prompt + ContentVersion + AuditEvent atomically.
5. `PublicContentInvalidationPort.invalidatePrompt` revalidates public paths.

## Lifecycle actions

| Action | Endpoint | Notes |
|--------|----------|-------|
| Publish / republish | `.../publish` | Creates immutable `ContentVersion`; `markPromptPublished` **preserves** entity `Prompt.source` |
| Hide | `.../hide` | `published → hidden`; keeps `publishedVersion` |
| Archive | `.../archive` | Removes from public; no physical delete |
| Restore archive | `.../restore` | `archived → draft`; clears `publishedAt`; not auto-published |

Hide/archive do not create ContentVersions.

## Source on publish

- `Prompt.source` — entity provenance (manual/portal or Google Sheets). Survives publish; Sheets import provenance is not wiped.
- `ContentVersion.source` — creation reason for that version (`portalSource()` for portal publish).
- See [PROMPT-SOURCE-PROVENANCE.md](./PROMPT-SOURCE-PROVENANCE.md) and [PROMPT-PUBLISHING-POLICY.md](../data-model/PROMPT-PUBLISHING-POLICY.md).

## Edit rules

- `draft`, `published`, and `hidden` prompts may be edited (working copy).
- `archived` prompts cannot be edited until restored to `draft`.

## Public visibility

Only `status === published` is readable publicly. Public catalog hydrates from `publishedVersion` snapshot via `promptFromPublishedSnapshot`, not the live working copy.

## See also

- [PROMPT-VERSIONS.md](./PROMPT-VERSIONS.md)
- [../data-model/PROMPT-PUBLISHING-POLICY.md](../data-model/PROMPT-PUBLISHING-POLICY.md)
- ADR 0010
