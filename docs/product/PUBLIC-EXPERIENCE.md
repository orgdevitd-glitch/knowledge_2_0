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
| `/search` | Search Experience |
| `/assistant` | Knowledge Assistant (capability-gated; disabled production shows unavailable) |

## Visibility

Only `published` materials are readable. Draft / hidden / archived return the same 404 as missing items.

## Shell

Structured Workspace: header, desktop sidebar, mobile panel, skip link, footer. Menu config: `src/features/public-content/nav.ts` (Главная, Все материалы, Статьи, Промты, Поиск). Assistant remains capability-gated and is not in the static list.

## Catalog filters

`/materials`, `/articles`, and `/prompts` share URL filters: `type`, `category`, `tag`, `audience`, `sort`, `q`, `page`. Taxonomy values are **slugs**. Changing a filter omits `page` (pagination resets).

Search Experience (`/search`) is a separate contract: taxonomy values are **IDs** (ADR 0013). Article/prompt tag chips link to the catalog, not to Search.

## Tags, categories, audiences

Detail pages show taxonomy titles (never IDs). Active values are links to `/materials?tag=` / `?category=` / `?audience=`. Archived values keep a readable title but are not offered as a new filter from the detail page. Empty taxonomy omits the row.

Material cards show category plus up to three tags (`+N` overflow). Audiences are linked on detail pages only (already catalog metadata; adding them to cards overloads the card).

## Article TOC

Shown when `buildTableOfContents` returns at least one heading (cap `tocMaxItems` = 40). Desktop: sticky sidebar. Mobile: `<details>` / «Содержание». Same `TocItem[]`; native `#anchor` links; no JS scroll manager. If an article has more than 40 headings, later headings remain in the body but are omitted from the TOC.

## Review status

`reviewDueAt` absent or invalid → no status. Future due → «Актуально»; ≤14 days → «Скоро потребуется проверка»; past due → «Требуется проверка». Color is not the only signal (`Status` includes text).

## Admin preview

`/admin/articles/[id]/preview` and `/admin/prompts/[id]/preview` stay admin-only + `noindex`. They build the same read model and render `ArticlePublicView` / `PromptPublicView` (ADR 0017). Related/media hydration uses the public/published boundary.

## Data

- Development/test: demo source (`CONTENT_SOURCE_MODE=demo` default)
- Production: empty source by default; demo forbidden

See `docs/content/DEMO-CONTENT.md` and `docs/architecture/PUBLIC-CONTENT-READ-MODEL.md`.
