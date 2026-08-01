import "server-only";

export { FIRESTORE_COLLECTIONS, FIRESTORE_SCHEMA_VERSION } from "./collections";
export { FirestoreArticleRepository } from "./firestore-article-repository";
export {
  FirestoreAudienceRepository,
  FirestoreCategoryRepository,
  FirestoreTagRepository,
} from "./firestore-taxonomy-repository";
export { FirestoreVersionRepository } from "./firestore-version-repository";
export { FirestoreAuditRepository } from "./firestore-audit-repository";
export {
  FirestoreUnitOfWork,
  type AtomicArticlePublishBundle,
} from "./firestore-unit-of-work";

/** Marker for architecture tests / composition. */
export const FIRESTORE_ADAPTERS_MARKER = "FIRESTORE_SERVER_ONLY" as const;
