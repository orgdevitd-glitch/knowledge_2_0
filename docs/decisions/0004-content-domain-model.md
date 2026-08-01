# ADR 0004 — Content domain model (Phase 3)

## Status

Accepted

## Context

The portal needs a typed content domain before Firestore, CMS UI, or public pages. Business rules must remain portable across storage adapters.

## Decisions

1. **Domain independence** — Domain code is plain TypeScript with Zod validation. No Next.js, React, Firestore, Firebase, Google APIs, HTTP, cookies, CSS, or env imports.

2. **Layering** — Domain + application use cases + repository interfaces + TEST_ONLY in-memory adapters. UI/API/Firestore deferred.

3. **Rich text** — Minimal structured `RichTextDocument` (text / line-break + bold/italic/code/link). No raw HTML editor.

4. **Blocks** — Discriminated union with `schemaVersion`. All 22 Phase 3 types validated. Unknown type/version rejected. Migration interface reserved.

5. **Prompt block** — References `PromptId` (+ presentation settings). Avoids dual source of truth vs embedded snapshots.

6. **Immutable versions** — Publish creates JSON-serializable snapshots. Restore copies into a new draft; history is never mutated.

7. **Optimistic concurrency** — Explicit `revision` field on mutable entities; repositories enforce `expectedRevision`.

8. **Source references** — Lightweight origin/sync metadata; secrets excluded; published versions marked portal-owned.

9. **Repository approach** — Storage-agnostic interfaces with pagination limits; in-memory for tests only.

10. **Republish** — While status is `published`, publish may create the next version without a status transition.

## Consequences

- Phase 4 can attach Firestore adapters and public read models without rewriting invariants.
- Full block catalog exists at schema level even where UI components are incomplete.
- Application tests use memory repositories; production composition must not.

## Rejected alternatives

- Embedding full Prompt snapshots in article blocks as primary storage.
- Using `updatedAt` alone for concurrency.
- Implementing Firestore or HTTP in Phase 3.
