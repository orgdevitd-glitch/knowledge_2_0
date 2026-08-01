# ADR 0007 — Admin article editor (Phase 5B)

## Status

Accepted

## Context

Phase 5A delivered auth + Firestore. Phase 5B needs a full article CMS without Google/media integrations.

## Decision

1. **Manual save** (metadata and blocks separately); no autosave.
2. **Local React reducer** editor state; no global state manager / form library.
3. **Optimistic concurrency** via `expectedRevision` + CONFLICT UI without merge.
4. **BlockDraft = domain ContentBlock** with factory defaults; no separate incompatible model.
5. **No drag-and-drop library** — buttons + keyboard reorder (`@pick-ui-library`: dnd-kit deferred).
6. **No rich-text WYSIWYG** — plain textarea ↔ `RichTextDocument`.
7. **Taxonomy** via Checkbox + SearchField (no combobox library).
8. **Minimal ConfirmDialog** without base-ui dependency.
9. **Saved-draft preview** route (admin-only, noindex); not unsaved query-string snapshots.
10. Dedicated mutation endpoints (not a generic action RPC).
11. **Atomic publish** via `FirestoreUnitOfWork.runAtomicArticlePublish`.
12. **PublicContentInvalidationPort** + Next `revalidatePath`.
13. Media/prompt blocks constrained until later phases.
14. Scope: **articles only**.

## Consequences

- Smaller bundle, stronger a11y for reorder without DnD.
- Publish still blocked for unresolved media/prompt placeholders.
- In-process rate limits remain non-distributed (documented).
