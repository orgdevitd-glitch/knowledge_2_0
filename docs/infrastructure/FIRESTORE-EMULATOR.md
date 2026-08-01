# Firestore Emulator (Phase 5A)

## Purpose

Integration and Security Rules tests must not touch a production Firebase project.

## Prerequisites

- **JDK 21+** on `PATH` (or `JAVA_HOME`). Current `firebase-tools` rejects older Java.
- Node 20+

## Commands

```bash
npm run firebase:emulators   # start Firestore emulator
npm run test:firestore       # emulator:exec + vitest src/tests/firestore
npm run test:rules           # emulator:exec + vitest src/tests/rules
```

`firebase-tools` is invoked via `npx` (not pinned as a runtime dependency).

## Test hygiene

- Suites clear emulator data between cases
- No shared mutable DB state across tests
- No real credentials required when `FIRESTORE_EMULATOR_HOST` is set
- Project id for tests: `demo-ckp` / `demo-ckp-rules`

## Config files

- `firebase.json` — emulator + rules/indexes paths
- `firestore.rules` — deny-all
- `firestore.indexes.json` — query indexes
- `.firebaserc.example` — template only (no real project id in repo)
