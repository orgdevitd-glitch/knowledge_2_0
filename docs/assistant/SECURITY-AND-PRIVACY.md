# Assistant Security and Privacy

## Trust boundary

- Retrieved Article/Prompt text is **untrusted data**.
- Prompt Library is never system/developer/tool instruction.
- No tool ports, write ports, media signed URLs, or admin credentials reach the provider.
- Indirect prompt injection tests cover “ignore policy”, secret exfil, tool calls, external URLs, fake citation keys, HTML/script.

## HTTP controls

- `POST /api/assistant/ask` only; `OPTIONS`/`GET` → 405 (no permissive CORS / no `Access-Control-Allow-Origin: *`)
- Browser POST: Origin **required** and allowlisted; `null` / missing / cross-origin rejected (403)
- `Sec-Fetch-Site: cross-site` rejected; `same-origin` / `same-site` / `none` / absent allowed
- `Content-Type: application/json` (optional `charset=utf-8` only)
- Bounded body reader counts **bytes** before `JSON.parse` (Content-Length is early hint only; malformed length → 400; oversize → 413)
- Strict Zod; reject client `systemPrompt` / `evidence` / `tools` / `messages` / `provider` / model fields
- `Cache-Control: private, no-store`
- Rate-limit + concurrency enforced inside `askAssistant` (not route-only)
- Application + provider timeouts; AbortSignal races ignore late provider results; concurrency released in `finally`
- Disabled mode short-circuits before retrieval/provider

## Privacy defaults

Do **not** persist: raw questions, answers, conversations, evidence, citations.

Logs may include: requestId, status, duration bucket, evidence/source/chunk/block/citation counts, safe refusal category, timeout/rate-limit flags, policy version.

Do **not** log: question text (raw or normalized), answer text, evidence text, source excerpts, IP, Origin, request body, provider payloads, system policy body, Error.message from providers/repos.

No question hashing. No analytics events.

## Rate limiting caveat

In-process limiter + `assistantRateLimitKeyFromRequest` are for tests/local/fake foundation only. X-Forwarded-For is **not** a trusted production identity without a separate proxy policy. Distributed cost protection for a real LLM is **not** implemented. Production provider enablement is blocked until Cloud Armor / gateway / Redis / transactional limiter is decided.
