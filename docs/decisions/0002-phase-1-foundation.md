# ADR 0002: Phase 1 foundation stack

## Status

Accepted

## Date

2026-07-28

## Context

Phase 1 must establish a runnable Next.js foundation (strict TypeScript, env validation, logging, health check, security headers, tests, CI) without wiring Firebase, Google APIs, CMS, or a design system.

The repository already contained Phase 0 docs, Cursor rules, and skills. The app had to be initialized **in the existing root** without destroying that work. Only **npm** was available in the environment (no pnpm/yarn).

## Decision

1. **Next.js App Router** (Next 16) with React 19 and `src/` + `@/*` alias — matches the approved architecture.
2. **npm** as the package manager; lockfile `package-lock.json` is authoritative for CI (`npm ci`).
3. **Manual scaffold** instead of destructive `create-next-app` overwrite — preserve `.agents`, `.cursor`, `docs`, and `AGENTS.md`.
4. **Zod-validated env** split into `src/config/env.ts` (`server-only`) and `src/config/public-env.ts` (`NEXT_PUBLIC_*`). No Firebase/Google secrets in Phase 1; optional vars do not block local startup.
5. **Logger** in `src/lib/logger.ts` over stdout — readable in development, JSON lines in production — suitable for Cloud Run log collection later without a Cloud Logging SDK now.
6. **Vitest** (node environment) for unit/integration tests of config, logger, security headers, and the health route handler. No e2e suite yet (no user journeys).
7. **Security headers** via `next.config.ts` + `src/server/security/headers.ts`, with looser CSP in development and HSTS only in production. Temporary CSP limits documented in `docs/security/CSP-PHASE1.md`.
8. **No Firebase, Firestore, Google API, or UI library** wiring in Phase 1.

## Consequences

- `npm run check` gates typecheck, lint, test, and production build.
- CI (GitHub Actions) mirrors the same gate without deploy or secrets.
- Later phases add integrations behind the existing config/logger/security seams.

## Alternatives considered

- Tailwind in Phase 1 — deferred; CSS custom properties cover the token foundation.
- Jest — Vitest chosen for faster modern DX with less config.
- Full `create-next-app` in a subfolder — rejected; app must live at repo root.
- Cloud Logging SDK now — deferred until Cloud Run deployment needs justify it.
