# Taxonomy Admin (Phase 7A)

Administrators manage **Category**, **Tag**, and **Audience** values used by articles, prompts, videos, and Google Sheets import.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/taxonomy` | Dashboard counts |
| `/admin/taxonomy/categories` | Category tree |
| `/admin/taxonomy/categories/new` | Create category |
| `/admin/taxonomy/categories/[id]/edit` | Edit / move / reorder / archive |
| `/admin/taxonomy/tags` | Tag list |
| `/admin/taxonomy/tags/new` | Create tag |
| `/admin/taxonomy/tags/[id]/edit` | Edit / archive |
| `/admin/taxonomy/audiences` | Audience list |
| `/admin/taxonomy/audiences/new` | Create audience |
| `/admin/taxonomy/audiences/[id]/edit` | Edit / reorder / archive |

All routes require `requireAdminPrincipal` and send `noindex`.

## Mutations

See `docs/architecture/TAXONOMY-MUTATION-FLOW.md`.

## Policies

- Archive instead of delete — see ADR 0009.
- Optimistic concurrency via `expectedRevision`.
- Usage panel shows Article / Prompt / Video references (not “popularity”).
- Article editor offers active values; linked archived values remain visible and removable.
- Sheets import resolves against current catalogs on **new** preview only.

## Out of scope

Prompt Admin, Video Admin, Media, merge tags, mass rewrite, automatic Google sync.
