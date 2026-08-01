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
| Cloud Storage | Published binary media; versioned search index JSON |
| Secret Manager | API keys, service credentials |
| Cloud Logging | Operational + security-relevant logs |

## Search architecture (v1)

On publish, build a normalized search document:

- `id`, `type`, `title`, `summary`, `headings`, `plainText`, `tags`, `categories`, `audiences`, `updatedAt`, `url`

Store a versioned aggregate index (JSON in GCS is acceptable for small/medium portals). Client library search and/or server filtering for protected data. Escalate to semantic/Vertex/RAG only with a confirmed need and ADR.

## Admin editor architecture (target)

- Block document model with ordered validated blocks  
- Optimistic concurrency (`updatedAt` + version)  
- Draft save, preview (desktop/mobile), publish, restore  
- Accessible DnD with keyboard alternatives  

## Environment separation

Distinct test vs production: Google sources, Firebase/GCP projects, secrets, and seed data. No production IDs in repository source.

## Out of scope for Phase 0

No running app, no Firebase/GCP wiring, no UI implementation. This document is the target architecture for later phases.
