# Grounding and Citations

## Provider evidence

Internal chunks become ephemeral keys `E1…En` with:

- `evidenceText`, `sourceTitle`, `entityType`
- `instructionBoundary: untrusted_data`
- no storage paths, no hrefs for the provider to invent

## Structured answer

```json
{
  "kind": "answered",
  "blocks": [{ "text": "plain text", "evidenceKeys": ["E1"] }]
}
```

Each substantive block must include ≥1 known evidence key. No Markdown, HTML, URLs, tools, or chain-of-thought.

## Server validation

- Unknown / missing keys → refusal
- HTML tags, Markdown links/images, URL schemes, protocol-relative URLs, and fake `[n]` citation markers in block text → refusal
- Ordinary brackets like `[важно]` and numbered lists `1. …` are allowed
- Answer/citation/block limits enforced
- Public citations built server-side from **authoritative** evidence sources; `href` only from validated snapshot slug + `isSafePublicSearchHref`
- Granularity: **citations per answer block** (not per sentence)
- Citation numbers assigned by first use of a source; multiple chunks of one source share one number; unused evidence omitted

## Final revalidation

After provider success, **cited** sources only are re-checked for published visibility and version match. Unused stale sources do not block. Any cited failure → `insufficient_evidence` (no automatic retry / second provider call).

## Honesty limits

The server proves citation keys refer to retrieved published evidence and remain publicly visible. It does **not** mathematically prove every sentence is semantically entailed. Do not claim hallucinations are eliminated or answers are guaranteed correct. Users should verify against sources.
