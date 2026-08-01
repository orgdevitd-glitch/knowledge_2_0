# Content Security Policy — Phase 5A

Builds on Phase 1 headers (`src/server/security/headers.ts`).

## Additions for Firebase Google Sign-In

| Directive | Added origins | Why |
|-----------|---------------|-----|
| `script-src` | `https://www.gstatic.com`, `https://apis.google.com` | Firebase Auth / gapi helpers |
| `connect-src` | `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `www.googleapis.com`, `firebaseinstallations.googleapis.com` | Auth token exchange |
| `frame-src` | `accounts.google.com`, `*.firebaseapp.com` | Google / Firebase auth frames |
| `img-src` | `lh3.googleusercontent.com`, `www.gstatic.com` | Account avatars / static assets |

No `*` wildcards for general script/connect. Production still omits `'unsafe-eval'` (dev keeps it for Next tooling).

CSP is **not** an authorization boundary. Admin access depends on session cookie + allowlist on the server.
