# Assistant UI states (Phase 8C.2)

All user-visible copy is either Foundation `publicMessageForStatus` or the controlled strings below. Never dump HTTP bodies, Zod issues, provider names, or `ASSISTANT_MODE`.

## Global unavailable (server)

When `getPublicAssistantCapability().available === false`:

- No form, no Retry, no demonstration badge.
- EmptyState: «Ассистент пока недоступен» / «Используйте поиск по опубликованным материалам.»
- Link to `/search`.
- Distinct from transient request failures.

## Idle

Empty textarea (or leftover question), filters default `article`, no answer.

## Pending

- Submit disabled / Button loading.
- Visible: «Готовим ответ по опубликованным материалам».
- `aria-live="polite"` short status (not the full answer).
- Previous answer hidden.
- «Отменить ожидание» available.

Cancel returns to idle with question and filters kept. No error banner. Focus textarea.

## Answered

Focus `#assistant-answer`. Disclaimer: answer is automatic from published materials; verify sources. Blocks + chips + «Источники».

## Insufficient evidence

Neutral EmptyState with server `message`. Actions: «Изменить вопрос», «Сбросить фильтры» if filters dirty, «Открыть обычный поиск» only if `searchHref` parses to pathname exactly `/search` with public Search query keys. Invalid href: keep insufficient state, hide the link and privacy notice, no redirect. If a safe href contains `q`, show that the wording will enter the Search URL and browser history. Not a system error.

## Validation

Alert/field error with safe message. Question kept. Focus question field.

## Rate limited

Status region with server message. Manual «Повторить». No quota numbers, no provider names, no auto-retry.

## Transient unavailable

Network, offline, 503, malformed JSON/DTO, HTTP/body mismatch.

- Title: «Ассистент временно недоступен»
- Manual Retry + `/search`
- No stack, status dump, or provider metadata

## New question

Clears question, answer, citations, errors; **keeps filters**; focus textarea.

## Reset filters

`type=article`, empty taxonomy; **keeps question**.
