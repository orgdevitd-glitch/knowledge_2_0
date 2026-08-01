# Corporate Knowledge Portal

Open corporate knowledge portal for instructions, prompt library, learning materials, scenarios, media, FAQ, search, and an admin page builder.

Public users read **published** content without registration. Administrators sign in with Google and manage articles and prompts in the admin CMS.

## Current status

**Phase 8A — Prompt administration** is the current admin CMS slice after Phase 7A Taxonomy admin.

- Create / edit prompts (manual save, revision conflicts)
- Preview, atomic publish, hide, archive, version restore
- Prompt list with dashboard, filters, and source/review metadata
- Article editor and Google import (Phase 6A) retained
- Mutation APIs protected by session + CSRF

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

Admin (with Firebase configured): `/admin/sign-in` → `/admin/articles`, `/admin/prompts`, `/admin/taxonomy`.

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
