# 0016: Admin shell and editorial pickers

## Title

0016: Admin shell and editorial pickers

## Status

Accepted

## Date

2026-08-17

## Context

Phase 8E.1 needs content managers to navigate admin and attach media/related materials without copying Firestore/entity IDs. Domain documents already store `mediaId` and related entity IDs. Public rendering already hydrates those IDs. A second related representation must not be invented.

## Decision

1. **Admin chrome** lives in `src/features/admin/ui/admin-shell.tsx`, reused from existing `AppHeader` / `Sidebar` / `MobileNavigationPanel`. Sign-in stays chrome-less. Sign out is in the shell, not duplicated on every page.

2. **Pickers** are admin-only GET endpoints under `/api/admin/pickers/*` (`runAdminGet` + per-admin rate limit). They return an allowlisted DTO (id, title, type/status, safe preview path or summary) with `Cache-Control: private, no-store`. Selection writes the existing stored ID into the current block or prompt metadata field. Search is a bounded title substring over existing admin lists (article scan cap 100, result cap 20) — not a full-text index and not a global catalog search.

3. **Related source of truth (unchanged):**
   - Article editor: `related-content` block items (`entityType` + `entityId`). Public also merges unused article metadata `relatedArticleIds` / `relatedPromptIds`; 8E.1 does not auto-copy block links into metadata.
   - Prompt editor: metadata `relatedArticleIds` (domain field already existed; now editable).
   - Video related UI is not added.

4. **Reusable dialog:** `AdminDialog` / `ConfirmDialog` in `features/admin/ui` (focus trap, Escape, restore focus). No new npm modal library.

5. **Search Generation ID** remains on `/admin/search` because that screen is technical operations, not the editorial flow.

## Consequences

Positive: editors pick media and related materials by title; archive/hide confirmations share one dialog.

Negative: picker search is a bounded title substring over existing admin lists (article scan cap 100), not a new search index. Empty picker copy must not claim “no matches in the entire catalog.”

Follow-up: Phase 8E.2 public tags/TOC/search-nav and preview=public renderer. Gemini/provider remains deferred (8C+ / not 8D in this slice).

## Alternatives considered

- Inline `<select>` of the full library: unbounded and unusable as the library grows.
- Third related store or semantic similarity: rejected.
- New UI kit for dialogs: rejected (`pick-ui-library` not required).
