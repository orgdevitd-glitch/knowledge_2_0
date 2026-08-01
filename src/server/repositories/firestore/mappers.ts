import "server-only";

import {
  deserializeArticle,
  serializeArticle,
  serializeContentVersion,
  deserializeContentVersion,
  serializePrompt,
  deserializePrompt,
} from "@/domain/content/serialize";
import type { Article } from "@/domain/content/article";
import type { Prompt } from "@/domain/content/prompt";
import type { Audience, Category, Tag } from "@/domain/content/taxonomy";
import type { ContentVersion } from "@/domain/content/versioning";
import type { AuditEvent } from "@/domain/content/audit";
import { ValidationError } from "@/domain/shared/errors";
import { FIRESTORE_SCHEMA_VERSION } from "./collections";

function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Invalid Firestore document");
  }
  return value as Record<string, unknown>;
}

function assertSchemaVersion(data: Record<string, unknown>): void {
  if (data.schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new ValidationError("Unsupported Firestore persistence schema version", {
      schemaVersion: data.schemaVersion,
      supported: FIRESTORE_SCHEMA_VERSION,
    });
  }
}

export function toArticleDoc(article: Article): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...serializeArticle(article),
  };
}

export function fromArticleDoc(docId: string, raw: unknown): Article {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  const rest = { ...data };
  delete rest.schemaVersion;
  const article = deserializeArticle(rest);
  if (article.id !== docId) {
    throw new ValidationError("Article document id mismatch", {
      docId,
      entityId: article.id,
    });
  }
  return article;
}

export function toTaxonomyDoc(
  entity: Category | Tag | Audience,
): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...JSON.parse(JSON.stringify(entity)),
  };
}

export function fromCategoryDoc(docId: string, raw: unknown): Category {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  if (data.id !== docId) {
    throw new ValidationError("Category document id mismatch");
  }
  return {
    id: data.id as Category["id"],
    slug: data.slug as Category["slug"],
    title: data.title as Category["title"],
    description: (data.description as string | null) ?? null,
    parentId: (data.parentId as Category["parentId"]) ?? null,
    sortOrder: data.sortOrder as Category["sortOrder"],
    status: data.status as Category["status"],
    createdAt: data.createdAt as Category["createdAt"],
    updatedAt: data.updatedAt as Category["updatedAt"],
    revision: data.revision as Category["revision"],
  };
}

export function fromTagDoc(docId: string, raw: unknown): Tag {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  if (data.id !== docId) {
    throw new ValidationError("Tag document id mismatch");
  }
  return {
    id: data.id as Tag["id"],
    slug: data.slug as Tag["slug"],
    title: data.title as Tag["title"],
    description: (data.description as string | null) ?? null,
    status: data.status as Tag["status"],
    createdAt: data.createdAt as Tag["createdAt"],
    updatedAt: data.updatedAt as Tag["updatedAt"],
    revision: data.revision as Tag["revision"],
  };
}

export function fromAudienceDoc(docId: string, raw: unknown): Audience {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  if (data.id !== docId) {
    throw new ValidationError("Audience document id mismatch");
  }
  return {
    id: data.id as Audience["id"],
    slug: data.slug as Audience["slug"],
    title: data.title as Audience["title"],
    description: (data.description as string | null) ?? null,
    sortOrder: data.sortOrder as Audience["sortOrder"],
    status: data.status as Audience["status"],
    createdAt: data.createdAt as Audience["createdAt"],
    updatedAt: data.updatedAt as Audience["updatedAt"],
    revision: data.revision as Audience["revision"],
  };
}

export function toVersionDoc(version: ContentVersion): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...serializeContentVersion(version),
  };
}

export function fromVersionDoc(docId: string, raw: unknown): ContentVersion {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  const rest = { ...data };
  delete rest.schemaVersion;
  const version = deserializeContentVersion(rest);
  if (version.id !== docId) {
    throw new ValidationError("Version document id mismatch");
  }
  return version;
}

export function toAuditDoc(event: AuditEvent): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...JSON.parse(JSON.stringify(event)),
  };
}

export function fromAuditDoc(docId: string, raw: unknown): AuditEvent {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  if (data.id !== docId) {
    throw new ValidationError("Audit document id mismatch");
  }
  return {
    id: data.id as AuditEvent["id"],
    eventType: data.eventType as AuditEvent["eventType"],
    entityType: data.entityType as AuditEvent["entityType"],
    entityId: String(data.entityId),
    actorId: data.actorId as AuditEvent["actorId"],
    occurredAt: data.occurredAt as AuditEvent["occurredAt"],
    metadata: (data.metadata as AuditEvent["metadata"]) ?? {},
  };
}

export function toPromptDoc(prompt: Prompt): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...serializePrompt(prompt),
    // Queryable denormalized fields (stripped on read).
    sourceType: prompt.source.type,
    sourceExternalId: prompt.source.externalId ?? null,
    sourceConnectionId: prompt.source.connectionId ?? null,
    titleLower: String(prompt.title).toLowerCase(),
  };
}

export function fromPromptDoc(docId: string, raw: unknown): Prompt {
  const data = assertObject(raw);
  assertSchemaVersion(data);
  const rest = { ...data };
  delete rest.schemaVersion;
  delete rest.sourceType;
  delete rest.sourceExternalId;
  delete rest.sourceConnectionId;
  delete rest.titleLower;
  const prompt = deserializePrompt(rest);
  if (prompt.id !== docId) {
    throw new ValidationError("Prompt document id mismatch", {
      docId,
      entityId: prompt.id,
    });
  }
  return prompt;
}
