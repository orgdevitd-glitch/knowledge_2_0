# Assistant Chunking

## Strategy (8C.1)

- **On request** — no persistent chunk index, embeddings collection, or GCS chunk generation.
- **Deterministic** chunk IDs via Node `crypto` over `entityType|entityId|versionId|ordinal|headingPath|sectionIdentity`.
- **Evidence keys** (`E1…En`) are assigned per ask request only; never reused across concurrent requests; never logged as content.
- Centralized budgets in `ASSISTANT_LIMIT_DEFAULTS` / `getAssistantConfig()`.

## Article

Sections from title, summary, and public blocks (`visibility !== internal`): headings, paragraphs, lists, quotes, tables (+ captions), steps, FAQ, checklists, callouts, code, meaningful image alt/captions, etc.

Oversized sections split on whitespace/punctuation boundaries.

## Prompt

Sections: title, summary, promptText, input/output requirements, restrictions, usage example.

Every Prompt chunk is marked `trustBoundary: untrusted_prompt_reference` and must never enter system policy.
