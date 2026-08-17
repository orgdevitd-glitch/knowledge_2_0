# Assistant Operations (Phase 8C.1)

## Modes

- Default / production: `ASSISTANT_MODE=disabled` (or unset → disabled).
- Test/local: `ASSISTANT_MODE=fake` for deterministic grounded answers.
- Fake in production → configuration error (fail-closed).

## Endpoint

`POST /api/assistant/ask`

HTTP mapping:

| Public status | HTTP |
|---------------|------|
| `answered` | 200 |
| `insufficient_evidence` | 200 |
| `validation_error` | 400 (413 if oversized body) |
| `rate_limited` | 429 |
| `temporarily_unavailable` | 503 |
| cross-origin / bad Origin | 403 |
| wrong Content-Type | 415 |

On insufficient evidence, response may include server-built `searchHref` via `buildSearchHref` + safety assert (relative `/search` only; never from provider). Opening it puts `q` in browser history — no automatic redirect.

## Observability

Structured logs event `assistant.ask` with operational fields only (see SECURITY-AND-PRIVACY).

No Firestore assistant collections in 8C.1. No admin `/admin/assistant` UI.

## Production blockers for real LLM

1. Provider + model + data-residency decision (ADR).
2. Distributed rate limiting / cost controls (trusted proxy identity).
3. Secret management for provider credentials.
4. Explicit production enablement mode beyond `disabled|fake`.
5. Phase 8C.2 UX + legal disclaimer as product requires.
