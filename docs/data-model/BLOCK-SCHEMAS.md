# Block Schemas

Domain schemas for content blocks (`src/domain/content/blocks.ts`). Not production UI.

## Common envelope

| Field | Notes |
|-------|-------|
| `id` | Stable `BlockId` |
| `type` | Discriminator |
| `schemaVersion` | Currently `1` |
| `data` | Type-specific payload |
| `settings` | `anchor`, `spacing`, `width`, `alignment` only — no arbitrary CSS |
| `visibility` | `all` \| `internal` |

Unknown `type` → `UnknownBlockTypeError`.  
Unknown `schemaVersion` → `UnsupportedBlockSchemaVersionError` (no silent migration).

Migration interface `BlockMigration` is reserved for future `v1 → v2` chains.

## Types (Phase 3)

| Type | Key rules |
|------|-----------|
| `heading` | level 2–4; non-empty text; H1 is page-level |
| `paragraph` | `RichTextDocument` only; no raw HTML |
| `list` | ordered/unordered; ≥1 non-empty item |
| `table` | ≥1 column; headers required; row width matches columns; no HTML cells |
| `image` | `mediaId`; `alt` required unless `decorative: true` |
| `gallery` | 2–30 images; unique `mediaId` |
| `video` | `videoId` or `mediaId`; title; `autoplay` always false |
| `file` | `mediaId`, title; mime/size untrusted metadata |
| `button` | label, safe URL/route, limited variant, `openInNewTab` |
| `link` | label, URL, internal/external; ban `javascript:`/`data:`/… |
| `quote` | text; optional attribution |
| `info` / `warning` / `tip` | optional title; required body |
| `steps` | ≥1 step with stable id, title, description; no completion state |
| `checklist` | ≥1 item with stable id; no user progress |
| `faq` | ≥1 Q/A with stable id |
| `prompt` | **references `PromptId`** + presentation flags |
| `code` | code, language; `executable: false` always |
| `related-content` | typed links; no duplicates; capped count |
| `divider` | empty strict data |
| `table-of-contents` | `auto` or explicit anchors (no DOM refs) |

## Prompt block decision

Prefer `promptId` reference over embedded snapshot so Prompt entity remains the single source of truth.

## Order

Block order is the array order. Reorder must preserve `BlockId`s.
