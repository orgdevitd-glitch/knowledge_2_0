import "server-only";

export const FIRESTORE_COLLECTIONS = {
  articles: "articles",
  prompts: "prompts",
  videos: "videos",
  categories: "categories",
  tags: "tags",
  audiences: "audiences",
  contentVersions: "contentVersions",
  auditEvents: "auditEvents",
  sourceConnections: "sourceConnections",
  importJobs: "importJobs",
  idempotencyRecords: "idempotencyRecords",
  mediaAssets: "mediaAssets",
  searchIndexFailures: "searchIndexFailures",
} as const;

export const FIRESTORE_SCHEMA_VERSION = 1 as const;
