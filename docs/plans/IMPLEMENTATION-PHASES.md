# Implementation Phases

Execute **one phase per assignment**. After each phase: typecheck → lint → tests → production build → manual check → report → **stop**.

## Phase 0 — Bootstrap

**Status:** done in this repository pass.

- Install agent skills (`emilkowalski/skills`)
- Create Cursor rules
- Create documentation
- Scaffold project structure
- Define verification commands
- Create architecture decision log

**Out of scope:** UI, Firebase/Firestore/Google API wiring, UI libraries (except skills tooling), deploy, content migration, legacy HTML as design basis.

## Phase 1 — Foundation

**Status:** implemented in repository (see ADR 0002).

- Next.js App Router
- TypeScript strict
- Environment configuration (typed, no secrets in repo)
- Base layouts
- Error handling
- Logging
- Health check
- CI wiring for verify scripts

## Phase 2 — Design system

Разделена на подэтапы:

### Phase 2A — Design direction and prototyping

**Status:** implemented in repository (prototypes only).

- Три изолированных направления на утверждённой палитре
- Сравнение сценариев, mock-данные, development-only маршруты
- Документ: `docs/design/DESIGN-DIRECTIONS.md`
- Выбор победителя — только решением пользователя

### Phase 2B — Production design system

**Status:** implemented in repository (see ADR 0003).

- Hybrid direction (Workspace shell + Editorial prose + limited Learning)
- Production tokens, IBM Plex Sans + Source Serif 4
- Layout / UI / content / learning components
- `/dev/design-system` showcase (dev-only)
- Docs: `DESIGN-SYSTEM.md`, `COMPONENT-CATALOG.md`

## Phase 3 — Content domain

**Status:** implemented in repository (see ADR 0004).

- Article / Prompt / Video domain entities
- All Phase 3 block schemas (discriminated union + schemaVersion)
- Taxonomy (Category, Tag, Audience), SourceReference, AuditEvent
- Immutable versions + restore → draft
- Repository interfaces + TEST_ONLY in-memory adapters
- Application use cases (no HTTP)
- Serialization, domain errors, optimistic concurrency (`revision`)
- Docs: CONTENT-MODEL, BLOCK-SCHEMAS, PUBLISHING-LIFECYCLE, REPOSITORY-CONTRACTS

**Out of scope:** Firestore, public pages, API routes, CMS editor, Google APIs, Phase 4.

## Phase 4 — Public vertical slice

**Status:** implemented in repository (see ADR 0005).

- Public shell (Structured Workspace)
- Home, materials/articles/prompts catalogs, article & prompt pages, search
- Public read models + published-only visibility
- Demo source (dev/test) / empty source (production); demo forbidden in prod
- Block renderer registry (22 types) + media unavailable fallback
- URL filters, pagination, SEO metadata, robots/sitemap
- Docs: PUBLIC-EXPERIENCE, PUBLIC-CONTENT-READ-MODEL, BASIC-SEARCH, DEMO-CONTENT

**Out of scope:** Firestore, Auth, CMS/editor, mutations, Google APIs, Phase 5.

## Phase 5 — Admin vertical slice

Разделена на подэтапы:

### Phase 5A — Admin security and Firestore foundation

**Status:** implemented in repository (see ADR 0006).

- Firebase Auth Google Sign-In + server session cookie + CSRF
- Allowlist access policy; `requireAdminPrincipal` server guard
- `/admin/sign-in`, `/admin`, `/admin/articles` (read-only)
- Firestore Admin SDK adapters (articles, taxonomy, versions, audit)
- Optimistic concurrency + Firestore Unit of Work (atomic publish primitive)
- Deny-all Security Rules + Emulator tests
- `FirestorePublicContentSource` (prompts/videos empty until later)
- Modes: `AUTH_MODE`, `PERSISTENCE_MODE`, `CONTENT_SOURCE_MODE=+firestore`
- Docs: ADMIN-AUTHENTICATION, SESSION-COOKIE, CSRF, FIREBASE-SETUP, FIRESTORE-MODEL, ADMIN-SECURITY-BOUNDARY

**Out of scope:** editor UI, create/edit/publish/restore UI, Google Docs/Drive, prompt/video admin, Phase 5B.

### Phase 5B — Admin editor and publishing UI

**Status:** implemented in repository (see ADR 0007).

- Article create / metadata / block editor (22 types)
- Manual save + revision conflicts
- Preview, publish (atomic), hide, archive, restore
- Version history + restore to draft
- Protected mutation API + PublicContentInvalidationPort
- Docs: ARTICLE-EDITOR, BLOCK-EDITOR, ARTICLE-PUBLISHING, VERSION-HISTORY, CONFLICT-HANDLING, ADMIN-MUTATION-FLOW

**Out of scope:** Google Docs/Drive, media uploads, Prompt/Video/Taxonomy admin, Phase 6.

## Phase 6A — Google Workspace manual import

**Status:** implemented in this repository pass (see ADR 0008).

- Server ADC + read-only Drive/Docs/Sheets scopes
- Shared Drive + root folder boundary
- SourceConnection, ImportJob, preview → confirm drafts
- Admin integrations UI + APIs
- Firestore Prompt repository for draft imports
- No automatic sync / write-back / Phase 6B

## Phase 6B — Automatic sync (later)

**Status:** not started.

- Drive changes feed / scheduler
- Conflict notifications
- Still no auto-publish without admin policy

## Phase 7A — Taxonomy administration

**Status:** implemented in this repository pass (see ADR 0009).

- Admin UI for Category / Tag / Audience
- Hierarchy move/reorder, archive/restore, usage panel
- Mutation APIs with CSRF, revision, audit, public invalidation
- Article editor + Sheets resolver consume live taxonomy
- No physical delete, no merge tags, no material mass-rewrite

**Out of scope:** Prompt/Video admin, Media, Google automatic sync (Phase 6B).

## Phase 7B — Media Library

**Status:** implemented in this repository pass (see ADR 0011).

- Admin UI for image + document upload (signed URL, MIME sniff, size limits)
- `MediaAsset` lifecycle: uploading → ready | failed; archive/restore; retry with new storageKey
- Ready binary immutable; public delivery `/media/[mediaId]`
- Article publish validates media references
- Private GCS + deny-all Storage rules; memory adapter for tests
- Docs: MEDIA-ADMIN, MEDIA-MODEL, MEDIA-STORAGE, MEDIA-MUTATION-FLOW

**Out of scope:** Video/audio upload, CDN, antivirus, physical delete, orphan sweeper.

## Phase 8A — Prompt Administration

**Status:** implemented in this repository pass (see ADR 0010).

- Admin UI for Prompt create / edit / preview / publish / hide / archive / restore
- Version history + restore to draft (no auto-publish)
- Mutation APIs with CSRF, revision, audit, public invalidation
- List dashboard, filters (status, taxonomy, source, review due), sort
- Imported Sheets prompts editable; `promptFromPublishedSnapshot` public read
- Docs: PROMPT-ADMIN, PROMPT-EDITOR, PROMPT-LIFECYCLE, PROMPT-VERSIONS, PROMPT-SOURCE-PROVENANCE, PROMPT-MUTATION-FLOW, PROMPT-PUBLISHING-POLICY

**Out of scope:** Video admin, Google write-back, automatic sync (6B), WYSIWYG, autosave, new UI libraries.

## Phase 8B.1 — Search Foundation

**Status:** implemented in this repository pass (see ADR 0012).

- SearchDocument v2 from published snapshots only
- `SearchIndexPort` + Memory (tests/local) + GCS (production) adapters
- Immutable index generations + CAS manifest flip
- Lifecycle after Article/Prompt publish / hide / archive
- Tombstones + sourceRevision / version guards
- `GET /api/search` with filters, cursor pagination, live visibility gate
- Full rebuild + reindex one entity + failure records
- Minimal admin `/admin/search`
- Docs: SEARCH-DOCUMENT, SEARCH-INDEX, SEARCH-API, SEARCH-OPERATIONS

**Out of scope:** suggestions, autocomplete, typo/morphology, query analytics, semantic search, embeddings, assistant, Video indexing, background retry workers, automatic orphan cleanup.

## Phase 8B.2 — Search experience

**Status:** implemented in this repository pass (see ADR 0013).

- Canonical Search URL state (`q` / type / taxonomy IDs / cursor)
- `/search` SSR UX: filters, chips, result cards, empty/short/long/no-results/cursor/unavailable states
- `GET /api/search/suggestions` (title + active taxonomy); accessible combobox
- Forward-only cursor pagination UX; honest page count copy
- Docs: SEARCH-EXPERIENCE, SEARCH-SUGGESTIONS

**Out of scope:** assistant, semantic search, embeddings, typo/morphology, analytics, query history, personalization, Video indexing, exact totals, backward cursor, page numbers.

## Phase 8C — Knowledge Assistant

- Answer sourcing on top of Search Foundation
- Semantic search / embeddings **only if confirmed necessary**

## Phase 9 — Analytics and feedback

- Views, searches, feedback
- Admin report

## Phase 10 — Content migration

- Transfer textual materials from approved content sources
- Completeness verification
- Manual acceptance  
Legacy HTML: text content only — never CSS/JS/layout/design.

---

## Quality gates (Phase 1+)

Every phase must pass:

1. Typecheck  
2. Lint  
3. Unit tests  
4. Integration tests  
5. Production build  
6. Manual verification  
7. Written report  

### Critical e2e (when features exist)

- Admin sign-in  
- Create draft  
- Edit blocks  
- Publish  
- Public denied draft access  
- Restore version  
- Google Docs import  
- Google Sheets import  
- Sync conflict  

### Accessibility checklist

Keyboard navigation, focus states, ARIA, contrast, reduced motion, image alt text, DnD without mouse, accessible video player, correct heading order.

## Report format

```text
Что реализовано
Какие файлы изменены
Какие архитектурные решения приняты
Какие проверки выполнены
Результаты проверок
Известные ограничения
Что не входило в задачу
```

## Commands

See `scripts/README.md`. Until Phase 1 lands `package.json`, use Phase 0 checks listed there.
