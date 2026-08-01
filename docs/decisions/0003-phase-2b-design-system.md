# ADR 0003: Phase 2B production design system

## Status

Accepted

## Date

2026-07-28

## Context

Phase 2A produced three directions. The product decision is a **hybrid**:

- Structured Workspace for shell, navigation, catalogs, admin
- Editorial Knowledge for long reading
- Guided Learning only for routes/progress/checklists

We need a production token + component layer without a visual UI-kit lock-in, with Cyrillic-capable fonts and minimal motion.

## Decision

1. **Own UI layer** in `src/components/{ui,layout,content}` with CSS Modules + CSS variables. No visual UI-kit. No Motion library for Phase 2B transitions.
2. **Fonts via `next/font`:** IBM Plex Sans (UI) + Source Serif 4 (editorial prose). Nunito Sans stays prototype-only.
3. **Icons:** lightweight inline glyphs / text symbols for now; no icon pack until a concrete need + `pick-ui-library` ADR.
4. **MobileNavigationPanel:** implemented with dialog semantics, Escape, focus return, body scroll lock — without a headless dependency.
5. **Tabs:** deferred; prefer base-ui later if complex tabs appear.
6. **Motion:** CSS `transform`/`opacity`, custom ease-out, reduced-motion + hover media queries.

## Consequences

- Design system showcase at `/dev/design-system` (404 in production).
- Phase 2A prototypes retained under `/dev/design-directions`.
- Later phases compose these primitives into real portal pages without redesigning tokens.

## Alternatives considered

- Tailwind + shadcn — rejected (visual/system lock-in risk; not required).
- base-ui now — deferred until complex menus/tabs demand it.
- Single font for everything — rejected; editorial reading needs serif measure.
