# System Architecture

## Goals

A secure, maintainable corporate knowledge portal with a clear separation of concerns, server-authoritative admin access, and a portal-owned content store as the publishing source of truth.

## Runtime topology (target)

```text
┌─────────────┐     HTTPS      ┌──────────────────┐
│  Browser    │ ─────────────► │  Cloud Run       │
│  (public /  │                │  Next.js app     │
│   admin)    │                └────────┬─────────┘
└─────────────┘                         │
          ▲                             ├── Firebase Auth (Google)
          │                             ├── Cloud Firestore
          │                             ├── Cloud Storage (media + search index)
          │                             ├── Secret Manager
          │                             ├── Cloud Logging
          │                             └── Google APIs (Drive/Docs/Sheets)
          │
          └── Public users: read published content only
              Admins: authenticated mutating flows
```

Periodic sync checks: **Cloud Scheduler** → app/worker endpoints (**Phase 6B**, not implemented in 6A).

Phase 6A: server-only Google Drive/Docs/Sheets **read** adapters, Shared Drive + root folder boundary, manual preview → confirm import into **drafts** only.

Phase 7A: admin Taxonomy management (Category / Tag / Audience) with archive-not-delete, usage analysis, and public invalidation (ADR 0009).

Phase 8A: admin Prompt library (create/edit, manual publish, hide/archive, version restore) with snapshot-based public reads and Sheets-import provenance (ADR 0010).

Phase 7B: Media Library — private GCS binaries, signed admin upload, MIME sniff, `mediaAssets` metadata, same-origin delivery at `/media/[mediaId]`, archive-not-delete (ADR 0011).

Phase 8B.1: Search Foundation — SearchDocument v2 from published snapshots, private GCS immutable generations + CAS manifest, Memory adapter for tests, `GET /api/search`, live visibility gate, admin rebuild/reindex (ADR 0012). Phase 8B.2: Search Experience — `/search` UX, URL state, filters/chips, `GET /api/search/suggestions` (ADR 0013). Phase 8C.1: Grounded Assistant Foundation — `POST /api/assistant/ask`, retrieval/provider ports, disabled/fake adapters (ADR 0014). Phase 8C.2 UI and production LLM adapter not started.

## Logical layers

```text
Presentation (App Router UI, content-block renderers)
        ↓
Application services (use-cases: publish, import preview, search rebuild)
        ↓
Domain (Article, Block, Prompt, Version, SourceConnection, roles)
        ↓
Repositories (persistence ports)
        ↓
Infrastructure adapters (Firestore, GCS, Auth, Google clients)
        ↓
External APIs
```

## Phase 4–5A public read path

```text
Public App Router pages
  → features/public-content queries
  → server/composition/public-content
  → PublicContentSource (empty | demo | firestore)
  → published-only filter + public DTOs
  → block renderer registry
```

Admin mutating path (Phase 5A foundation):

```text
/admin/* (Server Components)
  → requireAdminPrincipal (session cookie + allowlist)
  → AdminPersistence (Firestore Admin SDK adapters)
```

Client never talks to Firestore. See `docs/architecture/ADMIN-SECURITY-BOUNDARY.md` and ADR 0006.

Demo source remains development/test only.
See `docs/architecture/PUBLIC-CONTENT-READ-MODEL.md` and ADR 0005.

Cross-cutting:

- **Authorization** — session cookie + allowlist/role on every admin request
- **Audit** — append-only admin action log (UoW primitive ready; UI in 5B)
- **Search** — publish-time document generation + versioned index

**Rule:** UI components never talk to Firestore or Google APIs directly.

## Application surfaces

| Surface | Audience | Capabilities |
|---------|----------|--------------|
| `(public)` | Anonymous | Browse published catalog, articles, prompts, search |
| `admin` | Admin/editor | CMS, preview, publish, versions, import review |
| `api` | Browser/server | Public read APIs; protected admin APIs |

## AuthZ model

1. Firebase Authentication with Google Sign-In for staff.  
2. Role resolution on the server from DB allowlist and/or env configuration.  
3. Public routes never require auth.  
4. Admin UI may hide controls client-side for UX; **API enforces** again.  
5. CSRF protection on cookie-based mutating requests.  
6. Audit every admin action (who, what, when, entity, outcome).

## Content & publishing

- **Source of truth for published content:** portal database (Firestore).  
- Google Docs/Sheets/Drive: import and preparation only.  
- Publishing creates an **immutable version** snapshot.  
- Search index updates **after** successful publish; drafts never indexed.

### Publish pipeline (external import)

1. Detect change  
2. Load  
3. Normalize  
4. Preview version  
5. Diff for admin  
6. Confirm  
7. New version  
8. Publish  
9. Reindex  
10. Audit  

### Automation boundary

| Automatic | Manual |
|-----------|--------|
| Detect, fetch, preview, diff, error log, notify, reindex after publish | Accept changes, conflict resolution, publish, delete, restore |

## Data stores

| Store | Responsibility |
|-------|----------------|
| Firestore | Content entities, metadata, roles, sync connections, audit |
| Cloud Storage | Private media binaries (Phase 7B); versioned search index JSON |
| Secret Manager | API keys, service credentials |
| Cloud Logging | Operational + security-relevant logs |

## Search architecture (Phase 8B.1 + 8B.2)

- Build SearchDocument v2 **only** from immutable published Article/Prompt snapshots after successful content transactions.
- Persist durable index as immutable GCS generations under a private bucket; switch `manifest.json` with object-generation CAS.
- Public `GET /api/search` ranks candidates, applies taxonomy ID filters, integrity-protected cursors, then a live visibility gate (published + matching `versionId`).
- Index is a candidate source, not authority for visibility. Memory mode is forbidden in production.
- Phase 8B.2: Server Component `/search` calls the application service directly; `GET /api/search/suggestions` for title/taxonomy prefixes; taxonomy display titles resolved on the page layer (not in SearchDocument).
- Prompt Library text is untrusted reference material — never use indexed Prompt text as system/developer/tool instructions (Assistant rule; see `docs/search/ASSISTANT-TRUST-BOUNDARY.md`).
- Escalate to semantic/Vertex/RAG only with a confirmed need and ADR (Phase 8C+). Details: `docs/search/`.

## Knowledge Assistant architecture (Phase 8C.1)

- Application `askAssistant` depends on `AssistantRetrievalPort` + `AssistantProviderPort` only.
- Retrieval reuses Search Foundation candidates, then hydrates authoritative published snapshots and chunks on request.
- Default retrieval scope is **articles**; Prompt Library requires `type=prompt|all` and remains untrusted evidence.
- Provider modes: `disabled` (default) and `fake` (test/dev). No production vendor SDK in 8C.1.
- Citations are server-validated; final live visibility recheck before public response.
- Details: `docs/assistant/` and ADR 0014.

## Admin editor architecture (target)

- Block document model with ordered validated blocks  
- Optimistic concurrency (`updatedAt` + version)  
- Draft save, preview (desktop/mobile), publish, restore  
- Accessible DnD with keyboard alternatives  

## Environment separation

Distinct test vs production: Google sources, Firebase/GCP projects, secrets, and seed data. No production IDs in repository source.

## Out of scope for Phase 0

No running app, no Firebase/GCP wiring, no UI implementation. This document is the target architecture for later phases.
