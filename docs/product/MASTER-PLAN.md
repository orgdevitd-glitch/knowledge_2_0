# Master Plan — Corporate Knowledge Portal

## 1. Purpose

Build an open corporate knowledge portal containing:

- Instructions for ChatGPT and other digital tools
- Prompt library
- Learning materials
- Work scenarios
- Video materials
- Images and interactive screenshots
- Step-by-step guides
- FAQ
- Checklists
- Testing materials
- Related content
- Full-text search
- Knowledge-base assistant
- Administrative page builder

Public users open the portal and study **published** content without registration.  
Authorization is required only for administrators and editors.

This is a maintainable corporate web application — not a demo page.

## 2. Priorities (descending)

1. Architecture correctness  
2. Data and administrative security  
3. Simplicity of content management  
4. Code maintainability  
5. Interface accessibility  
6. Performance  
7. Visual quality  
8. Appropriate animation  

Do not sacrifice architecture or accessibility for visual effects.

## 3. Critical constraints

### 3.1 Legacy HTML materials

A previously prepared HTML file may be used **only** as a source of textual content.

Forbidden:

- Using it as a visual reference
- Porting its CSS, JavaScript, layout, components, or animations
- Using it as a technical foundation
- Treating its design as approved
- Using embedded images as design decisions

Content migration happens only after the platform exists and is verified (Phase 10).

### 3.2 No hardcoding

Do not hardcode articles, categories, section names, users, admin addresses, Google IDs, document/sheet IDs, Drive paths, dates, prompts, learning paths, concrete materials, working secrets, or environment configuration in application source.

Test data must be explicitly separated from production data.

### 3.3 Scope discipline

Do not implement the whole product in one pass. Each task is one phase or one complete vertical slice. After each phase: typecheck → lint → tests → production build → manual check → report → **stop**. Do not advance without a new assignment.

## 4. Product decisions

### 4.1 Public access

- No user registration, personal cabinets, or user profiles
- Published materials available without sign-in
- Drafts and hidden materials unavailable publicly
- Public surface is read-only

### 4.2 Administrative access

- Sign-in via Google
- Access determined by **server-side** role checks
- Admin list stored in database or environment configuration
- Client-side checks are insufficient
- Every admin API method re-validates session and role
- Every admin action is audited

### 4.3 Content source of truth

Portal database is the source of truth for published content.  
Google Docs, Sheets, and Drive are external import/preparation sources.  
External sources must not directly mutate published material.

Update process:

1. Detect change  
2. Load external material  
3. Normalize data  
4. Create preview version  
5. Show diffs to admin  
6. Obtain confirmation  
7. Create new material version  
8. Publish  
9. Update search index  
10. Record action in audit log  

### 4.4 Automation

**Automatic:** detect external changes, load data, form preview version, compute diffs, record errors, notify admin, update index after publish.

**Manual only:** accept external changes, resolve conflicts, publish new version, delete materials, restore old versions.

## 5. Technology stack

- Next.js (App Router), React, TypeScript strict
- Server Components where they reduce client JS; Client Components only for interactive scenarios
- Zod for input validation
- Firebase Authentication (Google Sign-In)
- Cloud Firestore (content & metadata)
- Google Cloud Storage (published files)
- Google Cloud Run (application)
- Google Secret Manager (secrets)
- Google Cloud Logging (logs)
- Google Cloud Scheduler (periodic checks)
- Google Drive / Docs / Sheets APIs

Do not install a library for one trivial function. Call `pick-ui-library` before adding a UI dependency.

## 6. Architectural layers

```text
UI
Application services
Domain
Repositories
Infrastructure adapters
External APIs
```

Also separate: authorization, audit, search.  
UI must not call Firestore or Google APIs directly.

## 7. Phases (summary)

| Phase | Name | Intent |
|------:|------|--------|
| 0 | Bootstrap | Skills, rules, docs, structure |
| 1 | Foundation | Next.js, strict TS, config, layouts, health, CI |
| 2 | Design system | Tokens, typography, core UI primitives |
| 3 | Content domain | Articles, blocks, versions, categories, tags, audit |
| 4 | Public vertical slice | Home, catalog, article, prompt, basic search |
| 5 | Admin vertical slice | Auth, list/create/edit, preview, publish, versions |
| 6 | Google integrations | Drive/Docs/Sheets, preview import, conflicts, logs |
| 7 | Media | Images, video, files, captions, transcripts |
| 8 | Search and assistant | Index, filters, hints, answer sources; semantic only if needed |
| 9 | Analytics and feedback | Views, searches, feedback, admin report |
| 10 | Content migration | Move textual materials, completeness check, acceptance |

Do not auto-advance phases. See `docs/plans/IMPLEMENTATION-PHASES.md`.

## 8. Admin page builder (target)

Admin can: create page → set title/URL → add/edit/reorder blocks → save draft → preview → publish → restore version.

Editor requirements: drag and drop, keyboard control, move buttons as DnD alternative, save without reload, unsaved-changes indicator, leave protection, validated blocks, desktop/mobile preview.

Concurrency: `updatedAt` + version number, optimistic check, conflict message — never silent overwrite.

## 9. Search

**v1:** Normalized search documents on publish; versioned JSON index (e.g. GCS); client search library and/or server filters; no drafts in index. No separate search platform until volume justifies it.

**Later (only if needed):** semantic search, embeddings, Vertex AI, RAG assistant, video transcript search.

## 10. Design & motion

Approved palette and character: see `docs/design/DESIGN-SYSTEM.md`.  
Animation only for named purposes; respect reduced motion; see design doc and skills policy.

## 11. Security & quality

See `docs/security/SECURITY-BASELINE.md` and testing section in `IMPLEMENTATION-PHASES.md`.

## 12. Skills policy

| Skill | Use |
|-------|-----|
| `emil-design-eng` | UI craft; must not change palette/architecture |
| `apple-design` | DnD, gestures, interruptible motion, sheets, reduced motion — not Apple visuals |
| `pick-ui-library` | Manual, before installing a UI library |
| `prototype` | High-value UI variants (3 genuinely different); no production change until pick |
| `find-animation-opportunities` | Analysis only after functional UI; ≤5–7 sentences for whole app |
| `improve-animations` | Plans in separate catalog; no source edits; don’t mix audit+impl |
| `review-animations` | Before finishing tasks with motion code |
| `animation-vocabulary` | Naming effects; not implementation |

## Related documents

- Architecture: `docs/architecture/SYSTEM-ARCHITECTURE.md`
- Structure: `docs/architecture/PROJECT-STRUCTURE.md`
- Content model: `docs/data-model/CONTENT-MODEL.md`
- Integrations: `docs/integrations/GOOGLE-INTEGRATIONS.md`
- Security: `docs/security/SECURITY-BASELINE.md`
- Design: `docs/design/DESIGN-SYSTEM.md`
- Phases: `docs/plans/IMPLEMENTATION-PHASES.md`
- Decisions: `docs/decisions/`
