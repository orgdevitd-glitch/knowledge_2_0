# Prompt Admin (Phase 8A)

Administrators manage the **Prompt** library: create and edit drafts, publish snapshots, hide/archive, and review version history. Imported Sheets prompts remain editable here.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/prompts` | List, dashboard, filters |
| `/admin/prompts/new` | Create form |
| `/admin/prompts/[promptId]` | Detail + source summary + recent audit |
| `/admin/prompts/[promptId]/edit` | Metadata + prompt text editor |
| `/admin/prompts/[promptId]/preview` | Saved draft preview (`noindex`) |
| `/admin/prompts/[promptId]/versions` | Version list |
| `/admin/prompts/[promptId]/versions/[versionId]` | Snapshot + restore |

All routes require `requireAdminPrincipal` and send `noindex`.

## List pagination (production contract)

Server-side `listAdmin` with:

- deterministic sort + Prompt id tie-breaker;
- validated cursor (`sort`, sort value, id);
- repository-level status / sourceType / single taxonomy `array-contains`;
- `nextCursor`;
- no “load first N → filter in memory → slice” silent truncation.

| Param | Values / notes |
|-------|----------------|
| `status` | `draft` \| `published` \| `hidden` \| `archived` (Firestore) |
| `sourceType` | `portal` \| `google-sheets` \| `manual` → `manual-import` (Firestore) |
| `category` / `tag` / `audience` | At most **one** taxonomy filter (`array-contains`) |
| `q` | Bounded scan (`maxPromptAdminScan`); may return `scanLimitExceeded` |
| `sort` | `updated-desc` (default) \| `title-asc` \| `created-desc` |
| `cursor` | Opaque; reset when filters change |
| `limit` | Default 20, max 50 |

Dashboard counts are incomplete when a cursor remains or search scan is bounded — never presented as full-catalog totals after silent truncation.

UI: «Следующая» / «В начало»; empty state ≠ scan-limit error.

Composite indexes: see `firestore.indexes.json` (`status`/`sourceType`/`title`/`createdAt`/`updatedAt` + `__name__`, taxonomy array-contains composites, source lookup).

## Mutations

See `docs/architecture/PROMPT-MUTATION-FLOW.md`. All Prompt writes go through atomic Prompt + Audit (+ Version on publish).

## Policies

- Manual save only; no autosave.
- Optimistic concurrency via `expectedRevision`.
- Archive instead of delete — see ADR 0010.
- Imported prompts are editable; publish is always manual; entity provenance survives publish.
- Taxonomy: active values for new selection; linked archived values remain visible and removable.
- Admin PATCH does not accept client `source` / import-managed external ids.

## Out of scope

Video Admin, Media (7B), Google write-back, automatic sync (6B), WYSIWYG editor, new UI libraries.

## See also

- [PROMPT-EDITOR.md](./PROMPT-EDITOR.md)
- [PROMPT-LIFECYCLE.md](./PROMPT-LIFECYCLE.md)
- [PROMPT-VERSIONS.md](./PROMPT-VERSIONS.md)
- [PROMPT-SOURCE-PROVENANCE.md](./PROMPT-SOURCE-PROVENANCE.md)
- ADR 0010
