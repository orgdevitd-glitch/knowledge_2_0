# Block editor (Phase 5B)

## Model

UI drafts map to domain `ContentBlock` (discriminated union, `schemaVersion = 1`). Unknown types / schema versions are rejected by domain validation on save.

## Palette groups

Text, Structure, Information, Interactive, Related, Media.

## Reorder

- Buttons: up / down / to start / to end
- Keyboard: Alt+ArrowUp / Alt+ArrowDown / Alt+Home / Alt+End
- **No drag-and-drop library** (ADR 0007)

## Media / prompt limits

- Image, gallery, file: choose ready assets from the Media Library picker (title → stored `mediaId`). Draft placeholders such as `media_pending` remain until a file is selected.
- Video block: poster image via the same picker (`posterMediaId`). Video binary / Video admin is still out of scope.
- Related-content block: pick published articles/prompts by title (stored `entityId`). Video related items are not added. Title search is a bounded admin scan (not full-text).
- Prompt block: pick a published prompt by title (stored `promptId`).

## Rich text

Paragraph (and similar) use `RichTextDocument` via plain textarea + `richTextFromPlain` / `richTextToPlain`. No contenteditable / raw HTML.
