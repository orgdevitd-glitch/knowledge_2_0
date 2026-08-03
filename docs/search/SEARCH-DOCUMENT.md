# SearchDocument (Phase 8B.1)

Stable id: `${entityType}:${entityId}`.

## Active document

Required fields: id, entityType (`article`|`prompt`), entityId, sourceRevision, versionId, versionNumber, state=`active`, slug, href, title, summary, bodyText, promptText, headings, categoryIds, tagIds, audienceIds, publishedAt, searchableText, schemaVersion=2.

Built only from immutable published snapshots via `articleFromPublishedSnapshot` / `promptFromPublishedSnapshot`.

## Tombstone

state=`removed` with id, entityType, entityId, sourceRevision, schemaVersion. Content fields omitted.

## Excluded

source credentials, owner email, Google IDs, storageKey, audit payloads, working draft text, video indexing.
