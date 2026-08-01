# Firebase setup (Phase 5A)

## What is wired

- Firebase Authentication (Google provider) for admins
- Firebase Admin SDK on the server (Auth + Firestore)
- Firestore Emulator for integration / rules tests
- Deny-all Security Rules (client SDK has no data access)

## What is not wired

Google Docs / Sheets / Drive, Storage uploads, client Firestore, CMS editor (Phase 5B).

## Local configuration

1. Copy `.env.example` → `.env.local`
2. Copy `.firebaserc.example` → `.firebaserc` with your project id (do not commit real project ids if policy forbids)
3. Enable Google Sign-In in Firebase Console
4. Set `AUTH_MODE=firebase` and `ADMIN_EMAIL_ALLOWLIST`
5. Set `NEXT_PUBLIC_FIREBASE_*` for the client Auth SDK
6. For Admin outside GCP: set `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` **or** use ADC
7. For Emulator: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`

On Google Cloud Run prefer **Application Default Credentials**. Do not commit service account JSON.

## Safe defaults without Firebase

`AUTH_MODE=disabled`, `CONTENT_SOURCE_MODE=empty|demo` — public site remains up; admin sign-in shows unavailable.

## Scripts

```bash
npm run firebase:emulators
npm run test:firestore
npm run test:rules
```

Uses `npx firebase-tools` (not a permanent project dependency).
