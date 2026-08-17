# ADR 0015: Assistant Experience (Phase 8C.2)

## Status

Accepted

## Date

2026-08-17

## Context

Phase 8C.1 shipped a provider-neutral `POST /api/assistant/ask` foundation (disabled/fake adapters, citation validation, same-origin POST). The product still had no public UI. Production assistant remains disabled; development/test can use the fake adapter. The UI must not look like a working production LLM, must not persist Q&A, and must not change grounding architecture.

## Decision

1. Public route is `/assistant`: a **single-turn search-like Q&A workspace**, not a chat (no bubbles, avatars, history, streaming, or typing simulation).
2. Availability is a **server-composed public projection** `getPublicAssistantCapability()`: `{ available, demonstration, questionMinLength, questionMaxLength }`. No `GET /api/assistant/status`. No raw `ASSISTANT_MODE`, provider, model, or policy version on the client.
3. **Conditional navigation:** `buildPublicNavItems({ assistantAvailable })`. Assistant is not in the static always-on `PUBLIC_NAV_ITEMS`. Homepage and search no-results CTAs appear only when `available`.
4. **Disabled production:** `GET /assistant` returns **200** with EmptyState, no form, no Retry, link to `/search`, `noindex,nofollow`. Sitemap omits `/assistant` while unavailable. POST remains Foundation fail-closed 503. Future production enablement should re-check sitemap cache/deployment semantics.
5. **Demonstration (dev/test fake):** full UI plus badge «Проверочный режим» and copy that answers come from a test adapter, not a working AI.
6. Type filter is always visible (default `article`). Taxonomy filters live in one `<details>Уточнить поиск</details>` set (no duplicate controls). Prompt warning only for `prompt|all`.
7. Client POSTs only to relative `/api/assistant/ask` with an allowlisted JSON body; AbortController + request sequence; no client timeout; Cancel means **stop waiting in the browser**, not a guarantee that server/provider work has stopped.
8. Question, filters, and answers stay in **ephemeral component state**. No URL question, no localStorage/sessionStorage/cookies for Q&A.
9. Citations are **post-block chips** with accessible names; sources are a **vertical** list; hrefs re-validated with `isSafePublicSearchHref`. Malformed answered DTOs are fail-closed as transient unavailable (no partial answer).
10. No new npm dependencies. Foundation ask contract, SearchDocument schemaVersion **2**, and GCS search generation schema stay unchanged.

## Consequences

- Phase 8C.2 can be accepted visually with `ASSISTANT_MODE=fake` locally without implying production enablement.
- Future real provider enablement should keep the same public DTO; UI does not select providers.
- In-process rate limiting and lack of a production LLM remain production blockers (ADR 0014).
- Search fallback is an explicit user action and may put `q` in `/search` browser history.
