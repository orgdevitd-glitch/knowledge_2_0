# Corporate Knowledge Portal

Open corporate knowledge portal for instructions, prompt library, learning materials, scenarios, media, FAQ, search, and an admin page builder.

Public users read **published** content without registration. Administrators sign in with Google and manage articles and prompts in the admin CMS.

## Current status

**Phase 8C.2 — Assistant Experience** is the current public assistant slice (on top of 8C.1 Foundation).

- Durable SearchDocument v2 + private GCS/memory index + `GET /api/search` (8B.1)
- Public `/search` UX + suggestions (8B.2)
- `POST /api/assistant/ask` — grounded single-turn ask with citation validation (8C.1)
- Public `/assistant` workspace (8C.2); production remains `ASSISTANT_MODE=disabled`
- Provider modes: `disabled` (default) and `fake` (test/dev demonstration only); no production LLM vendor yet
- Media Library, Prompt admin, and article editor retained
- Mutation APIs protected by session + CSRF

**Google Workspace**

- Phase 6A — manual Google Workspace integration (Drive/Docs/Sheets preview → confirm into drafts) is **complete**
- Phase 6B — automatic sync is **not started**

## Requirements

- Node.js **20+**
- npm **10+**
- Optional: JDK 21+ for Firestore Emulator tests

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Admin (with Firebase configured): `/admin/sign-in` → `/admin/articles`, `/admin/prompts`, `/admin/media`, `/admin/search`, `/admin/taxonomy`.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run test:firestore
npm run test:rules
npm run build
```

## Documentation

See `AGENTS.md` and `docs/admin/PROMPT-ADMIN.md`.
