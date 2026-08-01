# Environment variables

Canonical schemas live in:

- `src/config/env.ts` — server-only (never import from Client Components)
- `src/config/public-env.ts` — `NEXT_PUBLIC_*` only

Copy `.env.example` to `.env.local` for local overrides.  
`.env*` files (except `.env.example`) are gitignored.

## Variables

| Name | Scope | Required | Default | Purpose |
|------|-------|----------|---------|---------|
| `NODE_ENV` | server | set by runtime | `development` | Next.js / Node mode |
| `APP_ENV` | server | no | falls back to `NODE_ENV` | Logical label |
| `LOG_LEVEL` | server | no | `debug` (non-prod) / `info` (prod) | Logger threshold |
| `CONTENT_SOURCE_MODE` | server | no | `demo` (non-prod) / `empty` (prod) | `empty` \| `demo` \| `firestore` |
| `AUTH_MODE` | server | no | `disabled` | `disabled` \| `firebase` |
| `PERSISTENCE_MODE` | server | no | `firestore` (app) / `memory` (test default helper) | `memory` \| `firestore` |
| `SITE_URL` | server | no | — | Absolute origin (canonical, Origin checks) |
| `FIREBASE_PROJECT_ID` | server | when firebase/firestore modes need it | — | Firebase project |
| `FIREBASE_CLIENT_EMAIL` | server | no (ADC preferred) | — | Service account email fallback |
| `FIREBASE_PRIVATE_KEY` | server | no (ADC preferred) | — | PEM; `\n` normalized |
| `FIRESTORE_DATABASE_ID` | server | no | `(default)` | Named database if used |
| `FIRESTORE_EMULATOR_HOST` | server | no | — | e.g. `127.0.0.1:8080` |
| `ADMIN_EMAIL_ALLOWLIST` | server | when `AUTH_MODE=firebase` | — | Exact emails, comma-separated |
| `ADMIN_SESSION_MAX_AGE_SECONDS` | server | no | `28800` (8h); max 5d | Session cookie lifetime |
| `ADMIN_SESSION_COOKIE_NAME` | server | no | `__Host-…` (prod) / `ckp_admin_session` | Cookie name |
| `CSRF_COOKIE_NAME` | server | no | `ckp_csrf` | CSRF cookie |
| `NEXT_PUBLIC_APP_NAME` | public | no | `Corporate Knowledge Portal` | Display name |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | public | for client Auth | — | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | public | for client Auth | — | Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | public | for client Auth | — | Project id |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | public | for client Auth | — | App id |
| `GOOGLE_WORKSPACE_MODE` | server | no | `disabled` | `disabled` \| `service-account` |
| `GOOGLE_WORKSPACE_PROJECT_ID` | server | no | — | Optional GCP project label |
| `GOOGLE_WORKSPACE_SHARED_DRIVE_ID` | server | when mode=service-account | — | Shared Drive id |
| `GOOGLE_WORKSPACE_ROOT_FOLDER_ID` | server | when mode=service-account | — | Allowed root folder |
| `GOOGLE_WORKSPACE_ALLOWED_FOLDER_IDS` | server | no | — | Extra allowed roots (comma-separated) |
| `GOOGLE_WORKSPACE_MAX_FILE_SIZE_BYTES` | server | no | `26214400` | Soft size guard |
| `GOOGLE_WORKSPACE_IMPORT_PREVIEW_TTL_SECONDS` | server | no | `3600` | Preview expiry |
| `GOOGLE_WORKSPACE_REQUEST_TIMEOUT_MS` | server | no | `30000` | Google API timeout |
| `GOOGLE_WORKSPACE_MAX_RETRY_ATTEMPTS` | server | no | `3` | Safe read retries |

## Mode rules

### AUTH_MODE

- `disabled` — public works; admin sign-in unavailable; no hidden production bypass.
- `firebase` — requires `FIREBASE_PROJECT_ID` + non-empty allowlist.

### PERSISTENCE_MODE

- `memory` — **TEST_ONLY** / explicit local smoke; **forbidden in production**.
- `firestore` — Admin SDK adapters; emulator or ADC/env credentials.

### CONTENT_SOURCE_MODE

- `demo` — development/test catalog; **forbidden in production**.
- `empty` — production default until Firestore is configured.
- `firestore` — server-only public source; requires project or emulator host.

## Allowlist

- trim + lowercase; drop empties; dedupe
- exact email only — no `*`, no `@domain.com`
- never exposed to the client; secrets never appear in Zod error payloads beyond field names

## Forbidden credentials

Do not commit Firebase private keys, service account JSON, OAuth secrets, or Cloud Storage credentials. Prefer ADC on Cloud Run.
