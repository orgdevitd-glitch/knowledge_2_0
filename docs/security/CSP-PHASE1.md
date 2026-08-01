# Content-Security-Policy — Phase 1

## Intent

Ship a baseline CSP early without breaking Next.js local development or the production App Router bootstrap.

## Development

- Allows `'unsafe-eval'` and `'unsafe-inline'` for scripts (HMR / Next tooling).
- Omits HSTS (HTTP local servers).
- Omits `upgrade-insecure-requests`.

## Production (temporary)

- Drops `'unsafe-eval'`.
- Still allows `'unsafe-inline'` for scripts and styles until nonce/hash-based CSP is designed (needed for many Next.js setups).
- Adds `upgrade-insecure-requests` and HSTS.
- `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- `img-src` limited to `'self' data: blob:` until Cloud Storage / media CDNs are approved.

## Phase 5A update

Firebase Auth / Google Sign-In origins were added carefully (no broad `*`).  
See **`docs/security/CSP-PHASE5.md`** for the current allowlist and rationale.

## Planned tightenings (later phases)

- Nonce or hash-based `script-src` when feasible
- Remove temporary `'unsafe-inline'` where possible
- Document each exception in ADRs as needed

Implementation: `src/server/security/headers.ts` via `next.config.ts`.
