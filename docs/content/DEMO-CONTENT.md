# Demo content (Phase 4)

**DEMO / development / test only.** Not a production seed. Not real corporate content.

## Location

- Raw fixtures: `src/server/content-sources/demo/demo-dataset.ts`
- Loader (domain validation): `src/server/content-sources/demo/load-demo-catalog.ts`
- Source adapter: `src/server/content-sources/demo/demo-public-content-source.ts`

## Activation

`CONTENT_SOURCE_MODE=demo` (default in development/test).  
Forbidden when `NODE_ENV=production`.

## Contents

- Several published articles (including all 22 block types on `getting-started-portal`)
- Draft / hidden / archived articles for negative visibility tests
- Published + draft prompts
- Categories, tags, audiences

## Rules

- Public UI must not import fixtures directly — only via composition root + queries.
- Invalid demo data must fail validation at load time.
- Production empty source shows empty states without demo materials.
