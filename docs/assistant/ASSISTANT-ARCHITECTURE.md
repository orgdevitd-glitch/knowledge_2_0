# Assistant Architecture (Phase 8C.1)

## Scope

**Phase 8C.1 — Grounded Assistant Foundation** provides a provider-neutral, citation-validated ask pipeline. It does **not** include public UI (8C.2), a production LLM adapter, streaming, conversations, embeddings, or tools.

Related surfaces:

| Surface | Role |
|---------|------|
| Phase 8B.1 Search Foundation | Lexical candidate retrieval + durable index |
| Phase 8B.2 Search Experience | Public `/search` UX |
| Phase 8C.1 Assistant Foundation | Grounded ask API + retrieval/provider ports |
| Phase 8C.2 Assistant Experience | Public `/assistant` UI (future) |
| Prompt Library | Published reference materials (untrusted for assistant) |
| Assistant System Policy | Versioned in-code server policy (not Prompt Admin) |

## Pipeline

1. Same-origin + Content-Type + bounded body bytes; Zod validate; normalize question; re-validate length.
2. Rate-limit + concurrency inside `askAssistant` (disabled mode short-circuits before retrieval).
3. `AssistantRetrievalPort.retrieve` → one search generation → visibility → authoritative hydrate/bind → chunk → bound evidence.
4. Request-local evidence keys `E1…En` (never module-global).
5. `AssistantProviderPort.generateGroundedAnswer` with abort/timeout race (disabled/fake in 8C.1).
6. Validate structured blocks + plain-text safety + citation keys; renumber public citations.
7. Final visibility revalidation of **cited** sources only.
8. Allowlisted public DTO (`answered` | `insufficient_evidence` | …).

## Layers

- `src/domain/assistant/*` — types, limits, policy **version**, chunking, citations, output safety (no Next/Firebase).
- `src/features/assistant/application/*` — `askAssistant` orchestration.
- `src/server/repositories/interfaces/assistant-*-port.ts` — ports.
- `src/server/assistant/*` — retrieval, content binding, providers, rate limit, full system policy (`server-only`).
- `src/app/api/assistant/ask/route.ts` — thin HTTP adapter (origin/body only; no rate-limit-only path).

## Explicit non-goals (8C.1)

Real LLM vendor, streaming, UI, conversation history, Q&A persistence, analytics, personalization, embeddings/vector DB, tool calling, web browsing, portal mutations, production deployment enablement.
