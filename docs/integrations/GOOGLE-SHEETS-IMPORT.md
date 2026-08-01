# Google Sheets import (prompts)

Uses Sheets read APIs (`spreadsheets.values.batchGet`). Prompt sheet schema version 1.

Required columns: `external_id`, `title`, `prompt_text` (Russian aliases supported via exact header map).

List delimiter: `;`. Optional `_portal_schema` marker sheet.

Taxonomy tokens resolve to existing values only (`resolved|unresolved|ambiguous|archived`) — no auto-create.
New admin taxonomy values (Phase 7A) are visible to **new** previews only; existing ImportJob preview payloads are immutable snapshots.

All imported Prompts remain `draft`. Status column from Sheets is ignored/not supported for publish.
