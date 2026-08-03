import { createHash } from "node:crypto";

import {
  SEARCH_DOCUMENT_SCHEMA_VERSION,
  SEARCH_ENTITY_TYPES,
  SEARCH_LIMIT_DEFAULTS,
  type SearchEntityType,
} from "./search-limits";
import {
  isActiveSearchDocument,
  isSearchTombstone,
  type ActiveSearchDocument,
  type SearchDocument,
  type SearchDocumentId,
  type SearchTombstone,
} from "./search-document";
import { ValidationError } from "../shared/errors";

/** Path-safe prefix: no `..`, `\`, control chars, leading slash, empty segments. */
export function assertSearchIndexPrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) {
    throw new ValidationError("Invalid SEARCH_INDEX_PREFIX", {
      adminCode: "SEARCH_CONFIG_INVALID",
    });
  }
  if (
    trimmed.includes("..") ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/") ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    trimmed.split("/").some((s) => s.length === 0)
  ) {
    throw new ValidationError("Invalid SEARCH_INDEX_PREFIX", {
      adminCode: "SEARCH_CONFIG_INVALID",
    });
  }
  return trimmed;
}

export function assertSearchGenerationId(generationId: string): string {
  if (
    !generationId ||
    generationId.includes("..") ||
    generationId.includes("/") ||
    generationId.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(generationId) ||
    !/^[a-zA-Z0-9_-]+$/.test(generationId)
  ) {
    throw new ValidationError("Invalid search generation id", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  return generationId;
}

export function checksumSearchDocuments(
  documents: readonly SearchDocument[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...documents].sort((a, b) => a.id.localeCompare(b.id)),
      ),
    )
    .digest("hex")
    .slice(0, 32);
}

export type ParsedSearchManifest = {
  schemaVersion: number;
  generationId: string;
  createdAt: string;
  documentCount: number;
  activeDocumentCount: number;
  indexChecksum: string | null;
  previousGenerationId: string | null;
};

export function parseAndValidateSearchManifest(
  raw: unknown,
  limits?: { maxDocuments?: number },
): ParsedSearchManifest {
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("Invalid search manifest", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== SEARCH_DOCUMENT_SCHEMA_VERSION) {
    throw new ValidationError("Unsupported search manifest schema", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  if (typeof data.generationId !== "string") {
    throw new ValidationError("Invalid search manifest generationId", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  const generationId = assertSearchGenerationId(data.generationId);
  if (
    typeof data.createdAt !== "string" ||
    !Number.isFinite(Date.parse(data.createdAt))
  ) {
    throw new ValidationError("Invalid search manifest createdAt", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  const documentCount = Number(data.documentCount);
  const activeDocumentCount = Number(data.activeDocumentCount);
  const maxDocuments =
    limits?.maxDocuments ?? SEARCH_LIMIT_DEFAULTS.maxDocuments;
  if (
    !Number.isInteger(documentCount) ||
    documentCount < 0 ||
    documentCount > maxDocuments ||
    !Number.isInteger(activeDocumentCount) ||
    activeDocumentCount < 0 ||
    activeDocumentCount > documentCount
  ) {
    throw new ValidationError("Invalid search manifest counts", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  let indexChecksum: string | null = null;
  if (data.indexChecksum != null) {
    if (
      typeof data.indexChecksum !== "string" ||
      !/^[a-f0-9]{8,128}$/i.test(data.indexChecksum)
    ) {
      throw new ValidationError("Invalid search manifest checksum", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    indexChecksum = data.indexChecksum;
  }
  let previousGenerationId: string | null = null;
  if (data.previousGenerationId != null) {
    if (typeof data.previousGenerationId !== "string") {
      throw new ValidationError("Invalid previousGenerationId", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    previousGenerationId = assertSearchGenerationId(data.previousGenerationId);
  }
  return {
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
    generationId,
    createdAt: data.createdAt,
    documentCount,
    activeDocumentCount,
    indexChecksum,
    previousGenerationId,
  };
}

function assertEntityType(value: unknown): asserts value is SearchEntityType {
  if (!(SEARCH_ENTITY_TYPES as readonly string[]).includes(String(value))) {
    throw new ValidationError("Unsupported search entityType", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
}

export function parseAndValidateSearchGenerationPayload(input: {
  raw: unknown;
  expectedGenerationId: string;
  expectedChecksum?: string | null;
  expectedDocumentCount?: number;
  expectedActiveCount?: number;
  maxDocuments: number;
}): {
  generationId: string;
  createdAt: string;
  documents: SearchDocument[];
} {
  const {
    raw,
    expectedGenerationId,
    expectedChecksum,
    expectedDocumentCount,
    expectedActiveCount,
    maxDocuments,
  } = input;
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("Invalid search generation payload", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== SEARCH_DOCUMENT_SCHEMA_VERSION) {
    throw new ValidationError("Unsupported search generation schema", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  if (typeof data.generationId !== "string") {
    throw new ValidationError("Missing generationId in payload", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  const generationId = assertSearchGenerationId(data.generationId);
  if (generationId !== expectedGenerationId) {
    throw new ValidationError("Generation id mismatch", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  if (
    typeof data.createdAt !== "string" ||
    !Number.isFinite(Date.parse(data.createdAt))
  ) {
    throw new ValidationError("Invalid generation createdAt", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  if (!Array.isArray(data.documents)) {
    throw new ValidationError("Invalid generation documents", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  if (data.documents.length > maxDocuments) {
    throw new ValidationError("Generation exceeds max documents", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }

  const documents: SearchDocument[] = [];
  const seen = new Set<string>();
  for (const item of data.documents) {
    if (!item || typeof item !== "object") {
      throw new ValidationError("Invalid search document", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    const doc = item as Record<string, unknown>;
    assertEntityType(doc.entityType);
    if (typeof doc.entityId !== "string" || typeof doc.id !== "string") {
      throw new ValidationError("Invalid search document id fields", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    if (doc.id !== `${doc.entityType}:${doc.entityId}`) {
      throw new ValidationError("Deterministic search document id mismatch", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    if (seen.has(doc.id)) {
      throw new ValidationError("Duplicate search document ids", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    seen.add(doc.id);
    if (
      typeof doc.sourceRevision !== "number" ||
      !Number.isInteger(doc.sourceRevision)
    ) {
      throw new ValidationError("Invalid sourceRevision", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    if (doc.schemaVersion !== SEARCH_DOCUMENT_SCHEMA_VERSION) {
      throw new ValidationError("Invalid document schemaVersion", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    if (doc.state === "removed") {
      const tombstone: SearchTombstone = {
        id: doc.id as SearchDocumentId,
        entityType: doc.entityType,
        entityId: doc.entityId,
        sourceRevision: doc.sourceRevision,
        state: "removed",
        schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
        versionId: (doc.versionId as string | null | undefined) ?? null,
        versionNumber:
          (doc.versionNumber as number | null | undefined) ?? null,
      };
      documents.push(tombstone);
      continue;
    }
    if (doc.state !== "active") {
      throw new ValidationError("Invalid search document state", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    for (const key of [
      "versionId",
      "slug",
      "href",
      "title",
      "bodyText",
      "searchableText",
      "publishedAt",
    ] as const) {
      if (typeof doc[key] !== "string") {
        throw new ValidationError(`Missing active field ${key}`, {
          adminCode: "SEARCH_INDEX_CORRUPT",
        });
      }
    }
    if (typeof doc.versionNumber !== "number") {
      throw new ValidationError("Missing versionNumber", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    if (
      !Array.isArray(doc.headings) ||
      !Array.isArray(doc.categoryIds) ||
      !Array.isArray(doc.tagIds) ||
      !Array.isArray(doc.audienceIds)
    ) {
      throw new ValidationError("Invalid taxonomy/headings arrays", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
    documents.push(doc as unknown as ActiveSearchDocument);
  }

  if (
    expectedDocumentCount != null &&
    documents.length !== expectedDocumentCount
  ) {
    throw new ValidationError("Search generation documentCount mismatch", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  const activeCount = documents.filter(isActiveSearchDocument).length;
  if (expectedActiveCount != null && activeCount !== expectedActiveCount) {
    throw new ValidationError("Search generation activeCount mismatch", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }
  if (expectedChecksum) {
    const checksum = checksumSearchDocuments(documents);
    if (checksum !== expectedChecksum) {
      throw new ValidationError("Search generation checksum mismatch", {
        adminCode: "SEARCH_INDEX_CORRUPT",
      });
    }
  }
  if (
    activeCount + documents.filter(isSearchTombstone).length !==
    documents.length
  ) {
    throw new ValidationError("Search documents state inconsistency", {
      adminCode: "SEARCH_INDEX_CORRUPT",
    });
  }

  return {
    generationId,
    createdAt: data.createdAt,
    documents,
  };
}
