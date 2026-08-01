# Prompt version history (Phase 8A)

## List

`/admin/prompts/[promptId]/versions` — `versionNumber` desc, pagination, no full snapshots in list. Marks which version is current `publishedVersion`.

## Detail

`/admin/prompts/[promptId]/versions/[versionId]` — immutable `PromptSnapshot` fields rendered for admin review.

## Restore

`POST /api/admin/prompts/[promptId]/versions/[versionId]/restore`:

- Replaces current **working draft** from snapshot via `applyPromptVersionSnapshot`
- Does not mutate historical ContentVersion
- Does **not** publish
- Bumps `revision` + audit `version.restored`
- Redirects to editor

Confirmation warns that the current draft is replaced; the public page stays on the last published snapshot until a new publish.

## Snapshot contents

`PromptSnapshot` includes: slug, title, summary, taxonomy ids, `promptText`, optional requirement fields, related ids, `ownerId`, `reviewDueAt`. It does not include `status`, `publishedVersion`, or `source`.

## See also

- [PROMPT-LIFECYCLE.md](./PROMPT-LIFECYCLE.md)
- [../data-model/PUBLISHING-LIFECYCLE.md](../data-model/PUBLISHING-LIFECYCLE.md)
- ADR 0010
