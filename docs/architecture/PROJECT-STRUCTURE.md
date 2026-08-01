# Project Structure

Recommended layout for the Corporate Knowledge Portal. Directories were scaffolded in Phase 0 with `.gitkeep` placeholders. Application code arrives in later phases.

```text
src/
  app/
    (public)/          # Public App Router segment
    admin/             # Articles + Google integrations (Phase 6A)
    api/               # health + /api/auth/* + /api/admin/*
  components/
    ui/                # Design-system primitives
    layout/            # Shell, nav, breadcrumbs
    content/           # ArticleHeader, Prose, Callout, PromptBlock, …
  features/
    content/application/   # Domain write use cases
    public-content/        # Public queries, search, renderers, shell UI
    admin/                 # Admin article list/editor + auth UI
    integrations/google/   # Docs/Sheets import application + admin UI
  domain/
    content/           # Article, blocks, prompt, video, taxonomy, versions
    integrations/      # SourceConnection, ImportJob
    shared/            # IDs, VO, errors, status
  server/
    auth/              # CSRF, session, allowlist, guards
    firebase/          # Admin SDK singleton
    composition/       # public-content + admin-persistence + integration-ports
    content-sources/   # empty + demo + firestore public sources
    google-workspace/  # server-only Drive/Docs/Sheets adapters
    repositories/      # ports + memory (TEST_ONLY) + firestore adapters
  lib/
    firebase/client/   # Client-only Firebase Auth
  config/              # Typed configuration loaders
  styles/              # Tokens / global styles
  tests/               # Unit/integration/rules/firestore tests

.cursor/
  rules/               # Project rules (.mdc)
  skills/              # Pointer README only — canonical skills in .agents/skills

.agents/
  skills/              # Installed skills (skills.sh / npx skills) + LICENSE
  LICENSE-emilkowalski-skills.md

docs/
  product/
  architecture/
  data-model/
  security/
  infrastructure/
  integrations/
  design/
  decisions/
  plans/
  search/
  content/
  config/

scripts/               # Verify command docs
infrastructure/        # IaC / deploy specs (later phases)
firebase.json          # Emulator + rules/indexes
firestore.rules
firestore.indexes.json
```

Phase 5A admin routes: `/admin/sign-in`, `/admin`, `/admin/articles`.  
Public routes unchanged from Phase 4.

## Placement rules

| Concern | Place |
|---------|-------|
| Domain types & invariants | `src/domain` |
| Use-cases / orchestration | `src/server/services` |
| Persistence | `src/server/repositories` |
| Google/Firebase/GCS clients | `src/server/integrations` |
| AuthN/AuthZ helpers | `src/server/auth`, `src/server/security` |
| Audit writers | `src/server/audit` |
| Feature-specific UI + hooks | `src/features/<name>` |
| Reusable presentational UI | `src/components` |
| Routes only compose features/services | `src/app` |

## Skills location

Canonical install path from `npx skills`: **`.agents/skills/`** (full skill directories + `LICENSE`).  
`.cursor/skills/README.md` points agents to that path without duplicating files (avoids OS-specific symlinks/junctions in git).

## What must not live in the repo

- Secrets, service account keys, production Google resource IDs as hardcoded values  
- Copied legacy HTML/CSS/JS design foundations  
- Production content fixtures mixed with unit fixtures without labeling  

## Growth

Add folders when a phase needs them; do not invent parallel structures. If structure changes, record an ADR under `docs/decisions/`.
