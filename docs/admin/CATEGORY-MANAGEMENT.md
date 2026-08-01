# Category management

Categories are hierarchical (`parentId`, `sortOrder`).

## Operations

- Create root or child
- Edit title / slug / description / sortOrder
- Move to another parent or root (`POST .../move`)
- Reorder among siblings (`POST .../reorder` with `up` | `down` | `position`)
- Archive / restore

## Invariants

- Unique slug
- No self-parent / cycles
- Max depth 5
- Parent must exist and be active for new placement
- Archive does not cascade to children or materials

## UI

Tree view with expand/collapse, keyboard-accessible nested list (not incomplete ARIA tree). Move via parent select + Up/Down buttons (no DnD).
