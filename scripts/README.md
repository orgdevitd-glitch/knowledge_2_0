# Verification commands

Package manager: **npm** (lockfile: `package-lock.json`).

## Everyday scripts

```bash
npm run dev          # local Next.js server
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # ESLint
npm run test         # Vitest (unit/integration; skips emulator suites without host)
npm run test:firestore  # Firestore Emulator + repository/UoW tests
npm run test:rules      # Firestore Emulator + Security Rules tests
npm run firebase:emulators  # start Firestore emulator
npm run build        # production build
npm run start        # serve production build
```

## Aggregate gate

```bash
npm run check
```

Equivalent to:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Also run `npm run test:firestore` and `npm run test:rules` when changing persistence, rules, or taxonomy repositories (Phase 7A).

**Emulator prerequisite:** JDK **21+** (`JAVA_HOME` / `PATH`). Older Java (e.g. 8) fails with current `firebase-tools`.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`  
Runs `npm ci` then typecheck → lint → test → build. Emulator suites are optional until CI installs Firebase tools + Java. No deploy, no production secrets.

## Manual smoke

### Without Firebase

1. Public routes `/`, `/materials`, `/articles`, `/prompts`, `/search`
2. `/admin/sign-in` — unavailable / disabled auth message when `AUTH_MODE=disabled`
3. `/admin` — redirects to sign-in
4. `/api/health` — ok

### With Firebase configured

1. Allowlisted Google account can sign in
2. Non-allowlisted account denied with generic message
3. Session cookie HttpOnly; no ID token in Local/Session Storage
4. `/admin/articles` lists Firestore articles when persistence is configured
5. Logout clears session

### Production build

1. Empty catalogs by default
2. `/dev/*` → 404
3. Demo source absent
4. Auth disabled remains safe

## Phase notes

- Memory repositories are **TEST_ONLY**
- Demo public source is forbidden in production
- Firestore client access is deny-all; Admin SDK only
- Phase 5B editor/publish UI is not started
