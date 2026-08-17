# Assistant Retrieval

## Port

`AssistantRetrievalPort`:

- `retrieve({ question, filters }) → AssistantRetrievalResult`
- `revalidate(references) → { valid, invalidReferences }`

Application code depends only on this port — not GCS, Firestore adapters, HTTP Search API, or public Search DTOs.

## Search-backed adapter

`SearchBackedAssistantRetrieval` uses:

1. `SearchIndexPort.search` (in-process, assistant-specific candidate limit).
2. Type/category/tag/audience filters (`type` default **article**; prompts only for `prompt|all`).
3. `PublicSearchVisibilityPort.filterVisible` (published + matching `versionId`).
4. `PublicAssistantContentPort.loadPublishedSnapshots` (batched authoritative versions).
5. Deterministic on-request chunking + evidence budgets.

Status mapping:

| Retrieval status | Public outcome |
|------------------|----------------|
| `ok` | Continue to provider |
| `empty` | `insufficient_evidence` |
| `incomplete` | `insufficient_evidence` (no provider call) |
| `unavailable` | `temporarily_unavailable` |

Incomplete retrieval (truncated visibility scan that cannot confirm completeness) never reaches the provider in 8C.1.

## Authority

Evidence text and citation **title/href** come from immutable published `ContentVersion` snapshots after binding checks:

- live entity is `published` (not hidden/archived);
- `live.publishedVersion === candidate.versionId`;
- `version.entityType` and `version.entityId` match the candidate (no cross-entity version reuse);
- authoritative href is rebuilt from snapshot slug and checked with `isSafePublicSearchHref`.

SearchDocument fields (title/href/body) are **candidate retrieval only** — never final citation metadata.

SearchDocument schemaVersion remains **2**. GCS search generation schema is unchanged.

## Generation consistency

Each ask performs a single `SearchIndexPort.search` against the current generation (no cursor mixing across generations). Incomplete visibility scan or index unavailable → no provider call.
