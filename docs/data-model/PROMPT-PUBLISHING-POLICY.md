# Prompt publishing policy (Phase 8A)

## Invariant

A published prompt has two layers:

1. **Working draft** — live Firestore document (`prompts/{id}`): editable fields, `revision`, `status`, `source`, taxonomy ids, `promptText`, etc.
2. **Published snapshot** — immutable `ContentVersion` referenced by `publishedVersion`.

Public readers never see the working draft directly. `FirestorePublicContentSource` loads `publishedVersion`, reads the snapshot, and materializes the public view with `promptFromPublishedSnapshot(live, snapshot)`.

## Rules

| Concern | Policy |
|---------|--------|
| Draft edits | Change working copy only; public unchanged until republish |
| Republish | New ContentVersion; updates `publishedVersion` pointer |
| Hide | Status `hidden`; snapshot retained; not public |
| Archive | Status `archived`; not public |
| Restore version | Snapshot → working draft; `publishedVersion` unchanged; no auto-publish |
| Taxonomy on public | From snapshot ids only, not draft-only taxonomy changes |
| `reviewDueAt` | Stored in working copy and snapshot; admin scheduling metadata |
| `source` after publish | Working `Prompt.source` (entity provenance) is **preserved**; `ContentVersion.source` is portal creation reason only |

## Publish validation

`assertPromptPublishable`: non-empty `title`, `slug`, `promptText`, and `ownerId`. Taxonomy must be writable (no newly attached archived values).

## Alignment with Article

Same snapshot/working-copy split as Article publishing (ADR 0007). Prompt has no block editor; snapshot is flat `PromptSnapshot` JSON.

## See also

- [PUBLISHING-LIFECYCLE.md](./PUBLISHING-LIFECYCLE.md)
- [../admin/PROMPT-LIFECYCLE.md](../admin/PROMPT-LIFECYCLE.md)
- [../architecture/PUBLIC-CONTENT-READ-MODEL.md](../architecture/PUBLIC-CONTENT-READ-MODEL.md)
- ADR 0010
