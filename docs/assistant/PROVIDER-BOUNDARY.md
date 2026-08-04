# Assistant Provider Boundary

## Port

`AssistantProviderPort.generateGroundedAnswer(request, signal)`.

Request includes normalized question, filters summary, provider evidence, system policy **version**, locale, output limits, and `outputSchema: "grounded_blocks_v1"`.

Result is `answered | refused` with safe usage metadata — no vendor-specific objects cross the boundary.

## Adapters in 8C.1

| Mode | Adapter | Notes |
|------|---------|--------|
| `disabled` | `DisabledAssistantProviderAdapter` | Always unavailable |
| `fake` | `FakeAssistantProviderAdapter` | Deterministic test/dev only |

Production: fake forbidden; unknown mode rejected; real vendor adapter absent.

## System policy

Full policy text: `src/server/assistant/system-policy.ts` (`import "server-only"`).
Version constant only: `src/domain/assistant/system-policy.ts`.
Not editable via Prompt Admin. No secrets. No env storage of policy text. Never returned in public DTOs.

## Provider request minimization

Provider receives: normalized question, bounded evidence (`E*` keys, titles, entityType, evidenceText, trust markers), policy **version**, locale, output bounds.
Provider does **not** receive: href, entityId, versionId, chunkId, sourceRevision, storage/Google provenance, IP, headers, admin metadata.

## Future vendor work (out of scope)

Choosing OpenAI/Anthropic/Vertex/etc., SDK vs fetch, region/retention contracts, structured-output reliability, streaming format, and pricing require a separate customer/provider decision + ADR.
