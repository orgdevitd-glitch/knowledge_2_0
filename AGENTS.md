# AGENTS.md — Corporate Knowledge Portal

Short index for agents. Authoritative detail lives in `docs/` and `.cursor/rules/`.

## Product

Open corporate knowledge portal: instructions, prompt library, learning materials, scenarios, media, FAQ, checklists, search, KB assistant, and an admin page builder.

- **Public:** read published content, no registration.
- **Admin/editors:** Google Sign-In, server session cookie, allowlist, audited actions.

## Current phase

**Phase 8B.2 — Search Experience** (public `/search` UX on Search Foundation: URL state, filters, suggestions, result cards).
Do not start Phase 8C Knowledge Assistant, Video admin, or Google automatic sync (6B) unless explicitly assigned.

## Priorities

Architecture → security → CMS simplicity → maintainability → a11y → performance → visuals → animation.

## Stack (approved)

Next.js App Router, React, TypeScript strict, Zod, Firebase Auth, Firestore, GCS, Cloud Run, Secret Manager, Cloud Logging, Cloud Scheduler, Google Drive/Docs/Sheets (Phase 6A manual import complete; Phase 6B automatic sync not started).

Phase 5A: Admin SDK Firestore + deny-all rules; public may use empty/demo/firestore sources.

## Layout

| Path | Purpose |
|------|---------|
| `src/app/(public)` | Public routes + shell |
| `src/app/admin` | Admin shell (sign-in, home, articles, prompts, media, taxonomy, search) |
| `src/app/api` | HTTP API (health + auth + public search + suggestions) |
| `src/domain` | Domain model (content + shared + search) |
| `src/features/content/application` | Content write use cases |
| `src/features/search/application` | Search index lifecycle, query, rebuild, suggestions |
| `src/features/search/url` | Canonical public Search URL state |
| `src/features/search/ui` | Search experience components (form, chips, cards, combobox) |
| `src/features/public-content` | Public queries, Phase 4 search helpers, renderers, UI |
| `src/features/admin` | Admin queries + sign-in/out UI |
| `src/lib/firebase/client` | Client-only Firebase Auth |
| `src/server/firebase` | Admin SDK (server-only) |
| `src/server/auth` | Session, CSRF, allowlist, guards |
| `src/server/composition` | Public + admin composition roots |
| `src/server/content-sources` | empty / demo / firestore public sources |
| `src/server/repositories` | Ports + memory + Firestore adapters |
| `src/components` | UI / layout / content |
| `docs/` | Product & architecture docs |

## Rules map

| Rule | Mode | When |
|------|------|------|
| `project-core` | always | Critical constraints |
| `workflow` | always | Change protocol + report |
| `architecture` | agent-requested | Modules, layers, stack |
| `design-system` | globs (UI/styles) | Tokens, palette, motion |
| `content-model` | globs (domain/CMS) | Articles, blocks, versions |
| `google-integrations` | globs (integrations) | Drive/Docs/Sheets import |
| `security` | agent-requested | Authz, CSRF, CSP, secrets |
| `testing` | globs (tests) | Quality gates |
| `phase-completion-checklist` | manual `@` | End-of-phase checklist |

## Skills (emilkowalski/skills)

`emil-design-eng`, `apple-design`, `pick-ui-library`, `prototype`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `animation-vocabulary`.

License: `.agents/skills/LICENSE`.

## Docs map

- Product master plan → `docs/product/MASTER-PLAN.md`
- Architecture → `docs/architecture/SYSTEM-ARCHITECTURE.md`
- Admin security → `docs/architecture/ADMIN-SECURITY-BOUNDARY.md`
- Folder structure → `docs/architecture/PROJECT-STRUCTURE.md`
- Content model → `docs/data-model/CONTENT-MODEL.md`
- Public experience → `docs/product/PUBLIC-EXPERIENCE.md`
- Public read model → `docs/architecture/PUBLIC-CONTENT-READ-MODEL.md`
- Admin auth → `docs/security/ADMIN-AUTHENTICATION.md`
- Firebase setup → `docs/infrastructure/FIREBASE-SETUP.md`
- Firestore model → `docs/infrastructure/FIRESTORE-MODEL.md`
- Environment → `docs/config/ENVIRONMENT.md`
- Phases → `docs/plans/IMPLEMENTATION-PHASES.md`
- ADRs → `docs/decisions/`
- Search foundation → `docs/search/` (BASIC-SEARCH, SEARCH-DOCUMENT, SEARCH-INDEX, SEARCH-API, SEARCH-OPERATIONS, SEARCH-EXPERIENCE, SEARCH-SUGGESTIONS)

## Verification commands (Phase 5A+)

```bash
npm run typecheck
npm run lint
npm run test
npm run test:firestore
npm run test:rules
npm run build
# or: npm run check
```

See `scripts/README.md`.

## Hard bans (reminder)

No hardcoded content/IDs/secrets; no using legacy HTML as design/tech basis; one phase per task; stop after the report; do not start Phase 5B unless explicitly assigned.
