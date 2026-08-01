# Corporate Knowledge Portal

Open corporate knowledge portal for instructions, prompt library, learning materials, scenarios, media, FAQ, search, and an admin page builder.

Public users read **published** content without registration. Administrators sign in with Google and manage articles in the admin CMS.

## Current status

**Phase 6A — Google Workspace connections and manual import** is complete for this pass.

- Create / edit articles with block editor (manual save, revision conflicts)
- Preview, atomic publish, hide, archive, version restore
- Mutation APIs protected by session + CSRF
- Phase 5A auth/Firestore foundation retained

Phase 6 (Google integrations) is **not** started.

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

Admin (with Firebase configured): `/admin/sign-in` → `/admin/articles`.

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

See `AGENTS.md` and `docs/admin/ARTICLE-EDITOR.md`.
