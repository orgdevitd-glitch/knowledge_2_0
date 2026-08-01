# Corporate Knowledge Portal

Open corporate knowledge portal for instructions, prompt library, learning materials, scenarios, media, FAQ, search, and an admin page builder.

Public users read **published** content without registration. Administrators sign in with Google and manage articles and prompts in the admin CMS.

## Current status

**Phase 7B — Media Library** is the current admin CMS slice (after Phase 8A Prompt admin and Phase 7A Taxonomy).

- Upload images and documents (signed URL → sniff → ready)
- Media admin list, metadata edit, archive/restore, retry failed uploads
- Public delivery via `/media/[mediaId]` for ready assets
- Article publish validates referenced media is ready
- Prompt admin and article editor retained
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

Admin (with Firebase configured): `/admin/sign-in` → `/admin/articles`, `/admin/prompts`, `/admin/media`, `/admin/taxonomy`.

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
