# Search Index (Phase 8B.1)

## Port

`SearchIndexPort`: getCurrentGeneration, loadGeneration, applyMutation, replaceGeneration(documents, baseline), search, getStatus.

## Adapters

| Mode | Adapter | Use |
|------|---------|-----|
| memory | `MemorySearchIndexAdapter` | tests / local (forbidden in production) |
| gcs | `GcsSearchIndexAdapter` | production |

## GCS layout

```text
{prefix}/manifest.json
{prefix}/generations/{generationId}/index.json
```

Generations are immutable (`ifGenerationMatch: 0`). Manifest and generation payloads are schema-validated. Path segments reject `..`, `\`, controls, empty segments.

## CAS contracts

| Operation | Retry | Baseline |
|-----------|-------|----------|
| Entity mutation (`applyMutation`) | Bounded CAS retry; re-read current generation and re-apply | Latest current |
| Full rebuild (`replaceGeneration`) | **No** blind retry of stale candidate | Provider generation + generationId captured **before** scan |

On rebuild CAS conflict: orphan candidate may exist but is inactive; current generation unchanged; admin restarts rebuild.

## Tombstones after rebuild

Canonical rebuild generations include active published documents **and** minimal tombstones for hidden/archived entities (current aggregate revision). Incremental generations also keep tombstones. This prevents delayed lower-revision publish retries from resurrecting content after a rebuild that would otherwise drop ordering state.

## Corrupt generation

Search does **not** fall back to `previousGenerationId`. Returns safe temporary unavailable. Admin status shows `validationStatus=corrupt|unavailable`. Rebuild restores.

## Failures

See also: [SEARCH-EXPERIENCE.md](./SEARCH-EXPERIENCE.md) (Phase 8B.2 UX; no schema change).
