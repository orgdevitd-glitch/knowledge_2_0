# Project Structure

Recommended layout for the Corporate Knowledge Portal. Directories were scaffolded in Phase 0 with `.gitkeep` placeholders. Application code arrives in later phases.

```text
src/
  app/
    (public)/          # Public App Router segment
    admin/             # Articles, prompts, media, taxonomy, search, Google integrations
    api/               # health + /api/auth/* + /api/admin/* + /api/search(+ /suggestions) + /api/assistant/ask + /media/[mediaId]
  components/
    ui/                # Design-system primitives
    layout/            # Shell, nav, breadcrumbs
    content/           # ArticleHeader, Prose, Callout, PromptBlock, …
  features/
    content/application/   # Domain write use cases
    public-content/        # Public queries, Phase 4 search helpers, renderers, shell UI
    search/application/    # Phase 8B.1 index lifecycle, query, rebuild; 8B.2 suggestions
    search/url/            # Canonical public Search URL state (Phase 8B.2)
    search/ui/             # Search experience components (Phase 8B.2)
    assistant/application/ # Phase 8C.1 grounded ask orchestration
    admin/                 # Admin articles, prompts, media, taxonomy, search + auth UI
    integrations/google/   # Docs/Sheets import application + admin UI
  domain/
    content/           # Article, blocks, prompt, video, taxonomy, versions
    search/            # SearchDocument v2, limits, text normalize
    assistant/         # Assistant domain: limits, policy, chunking, citations
    integrations/      # SourceConnection, ImportJob
    shared/            # IDs, VO, errors, status
  server/
    auth/              # CSRF, session, allowlist, guards
    firebase/          # Admin SDK singleton
    composition/       # public-content + admin-persistence + integration-ports + search-ports + assistant-ports
    assistant/         # Search-backed retrieval, providers, assistant rate limit
    content-sources/   # empty + demo + firestore public sources
    google-workspace/  # server-only Drive/Docs/Sheets adapters
    search/            # GCS search index + cursor + visibility
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

Admin routes include `/admin/sign-in`, `/admin`, `/admin/articles`, `/admin/prompts` (Phase 8A), `/admin/media` (Phase 7B), `/admin/search` (Phase 8B.1), `/admin/integrations`, `/admin/taxonomy` (Phase 7A).
Public routes include `/media/[mediaId]` for ready binary delivery (Phase 7B) and `/search` Search Experience (Phase 8B.2) on Search Foundation. Assistant foundation exposes `POST /api/assistant/ask` only (no `/assistant` page until 8C.2).

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
