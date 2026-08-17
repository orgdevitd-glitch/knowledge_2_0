# Corporate Knowledge Portal

Open corporate knowledge portal for instructions, prompt library, learning materials, scenarios, media, FAQ, search, and an admin page builder.

Public users read **published** content without registration. Administrators sign in with Google and manage articles and prompts in the admin CMS.

## Current status

**Phase 8E.2 — Public Experience Hardening** is the current public-UX slice (Search in nav, tags/category catalog links, mobile article TOC, honest review status, admin preview using the public renderer). Public assistant remains 8C.2 (`ASSISTANT_MODE=disabled` in production). Gemini/provider and Phase 9 Analytics are not this slice.

- Durable SearchDocument v2 + private GCS/memory index + `GET /api/search` (8B.1)
- Public `/search` UX + suggestions (8B.2)
- `POST /api/assistant/ask` — grounded single-turn ask with citation validation (8C.1)
- Public `/assistant` workspace (8C.2); production remains `ASSISTANT_MODE=disabled`
- Provider modes: `disabled` (default) and `fake` (test/dev demonstration only); no production LLM vendor yet
- Media Library, Prompt admin, and article editor retained
- Media / related pickers by title (Phase 8E.1); IDs remain stored, not copied by the editor
- Public Search nav, tags, mobile TOC, and preview=public renderer (Phase 8E.2)
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
