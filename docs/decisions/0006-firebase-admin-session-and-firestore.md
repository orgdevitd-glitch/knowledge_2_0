# ADR 0006 — Firebase admin session and Firestore foundation

## Status

Accepted (Phase 5A)

## Context

Phase 4 delivered a public read vertical slice with empty/demo sources. Phase 5 needs a secure admin entry and durable persistence without shipping the CMS editor yet. The product forbids public registration and client-side Firestore access.

## Decision

1. **Firebase Authentication** with Google Sign-In for administrators only.
2. **Server Firebase session cookie** (`HttpOnly`) after ID-token exchange; client Firebase Auth persistence is cleared after exchange (no long-lived client admin session).
3. **Environment email allowlist** (`ADMIN_EMAIL_ALLOWLIST`) — exact emails, no wildcards/domains; verified email required.
4. **No public registration** and no Firestore user profile creation on first login.
5. **Firestore access only via Admin SDK** on the server; Security Rules deny all client read/write.
6. Explicit **persistence mappers** with `schemaVersion`, optimistic `revision`, and typed validation errors.
7. **Firestore Unit of Work** for future atomic publish (article + version + audit) without Phase 5B UI.
8. **Firestore Emulator** + rules unit tests for CI/local verification.
9. Explicit modes: `AUTH_MODE=disabled|firebase`, `PERSISTENCE_MODE=memory|firestore` (memory TEST_ONLY), `CONTENT_SOURCE_MODE=empty|demo|firestore`.
10. **Phase 5A / 5B split**: 5A = security + persistence foundation + read-only admin article list; 5B = editor/publish UI.

## Consequences

### Positive

- Production can run without Firebase (`AUTH_MODE=disabled`, empty content source).
- Clear server-only security boundary for later mutations.
- Deny-all rules prevent accidental client exposure.

### Negative / follow-ups

- In-process rate limit is not distributed across Cloud Run instances.
- CSRF signing material is derived (dedicated secret recommended later).
- Prompt/Video Firestore adapters are incomplete; public Firestore source returns empty lists for them.
- Editor, publish UI, Google Docs/Drive remain Phase 5B+.

## Alternatives considered

- Client Firestore with security rules for public reads — rejected (server read model + deny-all preferred).
- Long-lived client Firebase Auth for admin — rejected (session cookie + clear client session).
- `AUTH_MODE=mock-admin` in the app — rejected (tests inject fakes only).
