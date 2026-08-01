# Basic search (Phase 4)

In-process deterministic search over published materials only.

## Index fields

- Article: title, summary, headings, plain text from blocks
- Prompt: title, summary, promptText, requirements, restrictions

## Normalization

NFKC, trim, lowercase, whitespace collapse, Unicode-aware tokens. No browser locale dependency.

## Ranking weights

Centralized in `SEARCH_SCORE_WEIGHTS` (`src/features/public-content/limits.ts`):

1. Exact title
2. Title prefix
3. Title tokens
4. Taxonomy tokens
5. Summary
6. Headings
7. Body

Tie-break: `updatedAt` desc, then `title` asc.

## Limits

Min/max query length, max results, max indexed chars — `PUBLIC_CONTENT_LIMITS`.

## Highlighting

Safe React segments via `highlightSegments` — never `dangerouslySetInnerHTML`.

## Out of scope

Stemming, fuzzy libraries, embeddings, Vertex AI, external search engines.
