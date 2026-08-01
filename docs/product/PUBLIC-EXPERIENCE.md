# Public experience (Phase 4)

Public users read published materials without registration.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Home: intro, search, categories, recent materials, prompts, audiences |
| `/materials` | Unified catalog (article + prompt) with URL filters |
| `/articles` | Articles catalog |
| `/articles/[slug]` | Article detail (Editorial Knowledge) |
| `/prompts` | Prompts catalog |
| `/prompts/[slug]` | Prompt detail + copy |
| `/search` | Basic full-text search |

## Visibility

Only `published` materials are readable. Draft / hidden / archived return the same 404 as missing items.

## Shell

Structured Workspace: header, desktop sidebar, mobile panel, skip link, footer. Menu config: `src/features/public-content/nav.ts`.

## Data

- Development/test: demo source (`CONTENT_SOURCE_MODE=demo` default)
- Production: empty source by default; demo forbidden

See `docs/content/DEMO-CONTENT.md` and `docs/architecture/PUBLIC-CONTENT-READ-MODEL.md`.
