# Assistant Experience (Phase 8C.2)

Public UX on top of [Grounded Assistant Foundation](./ASSISTANT-ARCHITECTURE.md) (Phase 8C.1 / ADR 0014). Interaction model: ADR 0015.

## What this phase is

| Layer | Role |
| --- | --- |
| 8C.1 Foundation | `POST /api/assistant/ask`, retrieval, citations, disabled/fake providers |
| 8C.2 Experience | `/assistant` workspace, capability projection, form, states, a11y |
| Future provider | Not this phase |

## Route

`/assistant` — Server Component page. Interactive ask is a client island (`AssistantExperience`). The page never calls `askAssistant` in-process and never imports system policy or provider adapters.

## Capability

`getPublicAssistantCapability()` (server-only) returns:

- `available` — ask flow is configured (not disabled; config errors fail closed)
- `demonstration` — `available && NODE_ENV !== "production"` (fake/dev/test only)
- `questionMinLength` / `questionMaxLength`

The client cannot change capability. There is **no** public status API. Query parameters (`demonstration`, `mode`, `provider`) are ignored.

Sitemap lists `/assistant` only when capability.available. Future production enablement should re-check sitemap cache/deployment semantics; this phase does not add a dedicated invalidation hook.

## Disabled vs demonstration

- **Production disabled:** nav item hidden; no homepage/search CTA; `/assistant` 200 EmptyState without form/Retry; `noindex`; sitemap omits the route; POST still 503.
- **Demonstration:** full form; badge «Проверочный режим»; copy that answers come from a test adapter, not a working AI. Never shown when unavailable.

## Form and filters

- Labelled textarea «Вопрос», counter `N / max`, no autosubmit, no URL state.
- Type radio: Статьи / Промты / Все материалы (default article).
- Category / tag / audience: active-only IDs inside one `<details>Уточнить поиск</details>`.
- Prompt warning only when type is `prompt` or `all`.

## Client ask

`askAssistantClient` POSTs allowlisted JSON to `/api/assistant/ask`. AbortSignal + per-instance sequence. Stale responses ignored. Cancel: «Отменить ожидание» — aborts the **browser** request; it does **not** promise that server/provider execution has stopped.

No automatic retry. No question in URL or web storage.

## Answer

Plain-text blocks as React text (`<p>`). Citation chips after each block (`[n]`, `aria-label="Источник n: {title}"`) scroll/focus `#assistant-source-{n}`. Sources section is a vertical list with Badge + «Открыть материал». Unsafe hrefs never become links; a malformed answered payload is treated as transient unavailable.

## Privacy copy

The form states that the question is sent to build an answer from published materials, that the portal does not store question history, and that this is not a conversation. It does **not** claim that a future provider stores nothing, that data never leaves infrastructure, or that the question is never logged.

Opening a server `searchHref` is explicit and may put `q` in the Search URL and browser history. `searchHref` is accepted only when URL parsing yields pathname exactly `/search` and query keys are the public Search contract (`q`, `type`, `category`, `tag`, `audience`, `cursor`). Prefix-only strings are rejected.

## Out of scope

Real LLM, streaming, conversations, persistence, embeddings, tools, admin assistant UI, analytics, production enablement, WCAG certification claims, semantic-correctness guarantees.
