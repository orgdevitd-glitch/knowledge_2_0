# Prompt editor (Phase 8A)

## Purpose

Administrators create and edit prompts as drafts, then publish via the domain publishing flow.

## Routes

| Route | Role |
|-------|------|
| `/admin/prompts/new` | Explicit create form |
| `/admin/prompts/[promptId]/edit` | Metadata + `promptText` and optional fields |
| `/admin/prompts/[promptId]/preview` | Saved draft preview (`noindex`); same `PromptPublicView` as public (ADR 0017) |

## Fields

Working copy includes: `title`, `slug`, `summary`, `promptText`, `inputRequirements`, `outputRequirements`, `restrictions`, `usageExample`, `categoryIds`, `tagIds`, `audienceIds`, `relatedArticleIds`, `reviewDueAt`.

Clients cannot set `ownerId`, `status`, `publishedVersion`, or `source` directly on create (server assigns `ownerId` from session; `source` defaults to portal).

## Save strategy

- **Manual save** via `PATCH /api/admin/prompts/[promptId]` (single endpoint for all editable fields).
- Autosave is not used in Phase 8A.
- `expectedRevision` on every mutation; `CONFLICT` never force-overwrites.
- Dirty leave guard: `beforeunload` + in-app confirm (same pattern as Article editor).

## Taxonomy

- Checkbox + SearchField over active taxonomy (reuses Article editor taxonomy query).
- Linked archived values remain visible, labeled, and removable.
- New attachment of archived taxonomy is rejected server-side (`TAXONOMY_ARCHIVED`).

## Related articles

Editors pick published articles by title (`relatedArticleIds`). Search is a bounded title filter, not full-text. Public still shows only published-visible related materials. IDs stay in the stored document. An absent `relatedArticleIds` on PATCH does not clear existing links; `[]` is an explicit clear.

## Unsaved changes

Local React reducer tracks `fields` vs `savedFields`. Save button disabled when clean. Navigation away warns when dirty.

## Preview

`/admin/prompts/[promptId]/preview` is admin-only and `noindex`. It builds `PromptDetail` from the working copy via `buildPromptDetail` and renders `PromptPublicView` (same as the public prompt page). Related articles hydrate published-only (ADR 0017). Banner: «Предпросмотр черновика».

## Conflicts

On HTTP 409 `CONFLICT`, `ConflictAlert` offers reload from server or keep local edits. No merge or force-save. See [CONFLICT-HANDLING.md](./CONFLICT-HANDLING.md).

## Publish from editor

Publish opens a confirm dialog with optional `changeSummary`. Requires saved draft (no publish of unsaved local state). Server re-validates publish rules.

## Actor IDs

`ownerId` on create and audit `actorId` come from `AdminPrincipal.uid` via `UserId.parse` on the server.

## See also

- [PROMPT-LIFECYCLE.md](./PROMPT-LIFECYCLE.md)
- [CONFLICT-HANDLING.md](./CONFLICT-HANDLING.md)
- ADR 0010
