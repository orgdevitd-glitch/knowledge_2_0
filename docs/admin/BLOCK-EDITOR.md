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

- Image, gallery, video, file: editable captions/titles; media library deferred — blocks typically fail publish until real MediaIds exist.
- Prompt block: PromptId only; library not wired — unresolved references fail publish validation.

## Rich text

Paragraph (and similar) use `RichTextDocument` via plain textarea + `richTextFromPlain` / `richTextToPlain`. No contenteditable / raw HTML.
