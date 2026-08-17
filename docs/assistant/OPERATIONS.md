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

On insufficient evidence, response may include server-built `searchHref` via `buildSearchHref` + safety assert. The href must parse as pathname **exactly** `/search` with only public Search query keys (`q`, `type`, `category`, `tag`, `audience`, `cursor`). Prefix matches such as `/search-evil` or `/search/../admin` are rejected. Never from provider. Opening it puts `q` in browser history — no automatic redirect.

## Public UI

`GET /assistant` (Phase 8C.2). Capability from `getPublicAssistantCapability()`. No `GET /api/assistant/status`. Disabled: 200 EmptyState, noindex. Demonstration badge only when `demonstration=true`.

Sitemap includes `/assistant` only when that capability is available. A future production enablement should re-check deployment and CDN/cache semantics for `sitemap.xml` (`revalidatePath` / ISR), because this phase does not add a dedicated sitemap invalidation hook for assistant availability.

Query parameters such as `?demonstration=true`, `?mode=fake`, or `?provider=fake` do not change capability.

## Observability

Structured logs event `assistant.ask` with operational fields only (see SECURITY-AND-PRIVACY).

No Firestore assistant collections in 8C.1. No admin `/admin/assistant` UI.

## Production blockers for real LLM

1. Provider + model + data-residency decision (ADR).
2. Distributed rate limiting / cost controls (trusted proxy identity).
3. Secret management for provider credentials.
4. Explicit production enablement mode beyond `disabled|fake`.
5. Phase 8C.2 UX is implemented; legal/product disclaimer wording may still be refined by the customer.
6. Production remains `ASSISTANT_MODE=disabled` until items 1–4.
