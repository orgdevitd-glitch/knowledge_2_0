# ADR 0014 — Grounded Assistant Foundation (Phase 8C.1)

## Status

Accepted

## Date

2026-08-03

## Context

Phase 8B delivered Search Foundation (durable published-only index) and Search Experience. The product needs a Knowledge Assistant that answers only from published portal materials with verifiable citations, without executing Prompt Library text as instructions, without tools, and without persisting user questions.

A production LLM vendor is not chosen yet. The foundation must be provider-neutral, fail-closed, and testable with a deterministic fake adapter.

## Decision

1. **Split phases:** 8C.1 Grounded Assistant Foundation (this ADR) before 8C.2 Assistant Experience UI.
2. **Stateless single-turn** `POST /api/assistant/ask`; non-streaming structured plain-text blocks; no Markdown/HTML; no conversation persistence; no Q&A storage; no answer cache.
3. **Retrieval** via `AssistantRetrievalPort` backed by Search Foundation (`SearchIndexPort` + live visibility + authoritative `ContentVersion` hydration). Do not call HTTP `/api/search`. Do not change SearchDocument schemaVersion **2** or GCS search generation schema.
4. **Authoritative binding:** SearchDocument is candidate-only. Citation title/href and evidence text come from the current published snapshot. `ContentVersion.entityId` + `entityType` must match the candidate; cross-entity version reuse is fail-closed.
5. **Default content scope is articles only.** Prompt Library is included only when `filters.type` is `prompt` or `all`, and always as untrusted reference data (`ASSISTANT-TRUST-BOUNDARY`).
6. **On-request deterministic chunking** with **request-local** evidence keys (`E1…En`); no module-level evidence maps; no persistent chunk/vector index; no embeddings.
7. **One search generation per ask request** (single `SearchIndexPort.search` call). Incomplete/unavailable retrieval never reaches the provider.
8. **Citation validation** is structural: every answer block must cite known evidence keys; hrefs are server-owned and must pass `isSafePublicSearchHref`. Plain text forbids HTML, Markdown links/images, URL schemes, and fake `[n]` citation markers. Final visibility revalidation runs on **cited** sources only after the provider call; stale cited sources produce refusal (no second provider call).
9. **Browser POST contract:** required Origin allowlist, reject `Sec-Fetch-Site: cross-site`, JSON charset utf-8, bounded body reader (bytes before JSON.parse), no CORS open. Rate-limit/concurrency live in `askAssistant` (not route-only).
10. **Timeouts:** application + provider deadlines; AbortSignal races ignore late provider results; concurrency released in `finally`.
11. **Providers:** only `disabled` and `fake` adapters. `ASSISTANT_MODE=fake` forbidden in production. No vendor SDK, API key, model name, or `ASSISTANT_API_URL` in 8C.1. Client cannot select provider.
12. **System policy** full text is server-only (`src/server/assistant/system-policy.ts`); domain exposes version constant only.
13. **Privacy:** operational logs omit raw question, answer, evidence text, IP, Origin, and provider payloads. Structural citations do not prove semantic truth.

## Consequences

- Production assistant remains disabled until a provider ADR and distributed abuse controls exist.
- Lexical retrieval may miss paraphrases; embeddings/semantic search stay optional and ADR-gated.
- Structural citation checks reduce but do not eliminate unsupported claims — docs must not claim hallucinations are impossible.
- Phase 8C.2 can add `/assistant` UI without changing the ask contract.
- In-process rate limiting is insufficient for production LLM cost protection.

## Alternatives considered

- Streaming with post-hoc citation validation — rejected for 8C.1 (unsafe partial text).
- Server-persisted conversations — rejected (privacy + cost).
- Using public Search DTO / snippets as sole evidence — rejected (need authoritative snapshots).
- Changing SearchDocument for chunk metadata — rejected (runtime hydration sufficient).
