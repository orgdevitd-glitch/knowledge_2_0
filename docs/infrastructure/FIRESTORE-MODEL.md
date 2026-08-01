# Firestore model (Phase 5A)

## Access pattern

All application reads/writes use **Firebase Admin SDK** on the server. Security Rules deny all client access:

```
allow read, write: if false;
```

## Collections

| Collection | Phase 5A adapter |
|------------|------------------|
| `articles/{articleId}` | full |
| `categories/{categoryId}` | full |
| `tags/{tagId}` | full |
| `audiences/{audienceId}` | full |
| `contentVersions/{versionId}` | full (immutable save) |
| `auditEvents/{auditEventId}` | full (immutable save) |
| `prompts/{promptId}` | full (Phase 6A FirestorePromptRepository; public shows published only) |
| `videos/{videoId}` | skeleton / unused by public Firestore source |
| `sourceConnections/{id}` | Phase 6A Google source metadata |
| `importJobs/{id}` | Phase 6A import preview / confirm jobs |
| `idempotencyRecords/{hash}` | Phase 6A confirm idempotency |

## Persistence documents

Domain entities map through explicit mappers (`src/server/repositories/firestore/mappers.ts`):

- `schemaVersion` on every document
- Firestore `Timestamp` does not leak into domain (ISO strings in domain)
- document id must match entity id
- unknown schema version → typed validation error
- damaged documents are rejected (not silently “fixed”)

## Optimistic concurrency

Article (and taxonomy) saves run in a transaction: read → check `expectedRevision` → write incremented revision. Stale revision → `ConflictError`. Unique slug checked inside the transaction.

## Unit of Work

`FirestoreUnitOfWork.runAtomicArticlePublish` writes article + content version + audit atomically. Transaction callbacks must keep all reads before writes and avoid external side effects. IDs/timestamps for one application operation are fixed so retries do not invent new audit/version identities.

## Indexes

See `firestore.indexes.json`. Each composite index maps to a real query (status+updatedAt, status+publishedAt, versions/audit by entity). Single-field indexes are insufficient for those compound filters/sorts.

## Public source limitation

`FirestorePublicContentSource` serves published articles + taxonomy. **Prompts and videos return empty lists** until their adapters are completed in a later phase. Demo source behavior is unchanged in development.
