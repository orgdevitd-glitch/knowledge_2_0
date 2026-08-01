# ADR 0001: Phase 0 bootstrap baselines

## Status

Accepted

## Date

2026-07-28

## Context

The repository started empty (no git history, no `package.json`, no Cursor rules, no docs). Phase 0 requires skills, rules, documentation, structure, verification command definitions, and an ADR log — without building the application.

## Decision

1. **Skills:** Install the full `emilkowalski/skills` set via `npx skills@latest add emilkowalski/skills` into `.agents/skills/`, with MIT license retained beside the skills. Keep `.cursor/skills/` as a pointer README only (no duplicated bodies, no OS-specific junction in git).
2. **Rules:** Split guidance into focused `.cursor/rules/*.mdc` files. Use `alwaysApply` only for short critical constraints (`project-core`, `workflow`). Use globs for directory-scoped rules, agent-requested descriptions for specialized domains, and one manual checklist rule.
3. **Docs:** Capture the full approved AGENT SPECIFICATION across `docs/product`, `architecture`, `data-model`, `integrations`, `security`, `design`, `plans`, and `decisions`.
4. **Structure:** Scaffold the recommended `src/`, `docs/`, `scripts/`, and `infrastructure/` trees with placeholders only — no Next.js app, no Firebase/Google wiring, no UI libraries, no deploy, no content migration.
5. **Verification:** Document planned npm scripts in `scripts/README.md`; do not fabricate a toolchain in Phase 0.

## Consequences

- Agents have durable product/architecture context without stuffing the master plan into a single always-on rule.
- Phase 1 can introduce Next.js against an agreed structure and rule set.
- Skills updates should be applied via the skills CLI against `.agents/skills/`.

## Alternatives considered

- Single monolithic alwaysApply rule — rejected (context overload; forbidden by Phase 0 brief).
- Duplicating skills into both `.agents/skills` and `.cursor/skills` — rejected (drift risk).
- Git-tracked Windows junction from `.cursor/skills` → `.agents/skills` — rejected (poor cross-OS portability); pointer README used instead.
- Initializing Next.js in Phase 0 — rejected (belongs to Phase 1).
