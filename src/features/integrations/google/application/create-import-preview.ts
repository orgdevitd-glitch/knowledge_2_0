import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import { parseImportJob } from "@/domain/integrations/import-job";
import { NotFoundError } from "@/domain/shared/errors";
import { CONTENT_LIMITS } from "@/domain/shared/limits";
import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import { GOOGLE_DRIVE_MIME_TYPES } from "@/server/google-workspace/ports";
import { GOOGLE_WORKSPACE_LIMITS } from "@/server/google-workspace/limits";
import { validateBlocks } from "@/domain/content/blocks";

import { mapGoogleDocToArticleImportDraft } from "../docs/map-google-doc-to-draft";
import { checksumArticleImportDraft } from "../docs/checksum";
import {
  parsePromptSheet,
  PORTAL_SCHEMA_SHEET_NAME,
} from "../sheets/parse-prompt-sheet";
import { structuralDiffArticle } from "./structural-diff";
import type { IntegrationPorts } from "./ports";

function previewExpiresAt(ports: IntegrationPorts): string {
  const ttl = ports.config.importPreviewTtlSeconds;
  return new Date(Date.now() + ttl * 1000).toISOString();
}

function assertPreviewSize(preview: Record<string, unknown>): void {
  const bytes = Buffer.byteLength(JSON.stringify(preview), "utf8");
  if (bytes > GOOGLE_WORKSPACE_LIMITS.MAX_PREVIEW_BYTES) {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import preview exceeds size limit",
      { bytes },
    );
  }
}

/** Collect unique external_id values from a Sheet data range (header row required). */
function collectSheetExternalIds(rows: string[][]): string[] {
  if (rows.length < 2) return [];
  const headers = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase());
  const idx = headers.indexOf("external_id");
  if (idx < 0) return [];
  const ids = new Set<string>();
  for (let i = 1; i < rows.length; i += 1) {
    const value = String(rows[i]?.[idx] ?? "").trim();
    if (value) ids.add(value);
  }
  return [...ids];
}

export async function createDocsImportPreview(
  ports: IntegrationPorts,
  input: {
    actorId: string;
    requestId: string;
    sourceId: string;
    targetArticleId?: string | null;
  },
) {
  const source = await ports.sources.getById(input.sourceId);
  if (!source) {
    throw new NotFoundError("Source connection not found", {
      sourceId: input.sourceId,
    });
  }
  if (source.status === "archived") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Archived source cannot create preview",
    );
  }
  if (source.mimeType !== GOOGLE_DRIVE_MIME_TYPES.document) {
    throw new GoogleWorkspaceError(
      "GOOGLE_UNSUPPORTED_FILE_TYPE",
      "Source is not a Google Doc",
    );
  }

  const policy = new GoogleDriveBoundaryPolicy(ports.google.drive, ports.config);
  const metadata = await policy.verifyFileForImport(source.externalId);
  const document = await ports.google.docs.getDocument(metadata.id);
  const draft = mapGoogleDocToArticleImportDraft(document, {
    documentId: metadata.id,
    externalUrl: metadata.webViewLink ?? undefined,
    modifiedAt: metadata.modifiedTime,
  });

  let domainBlockErrors: string[] = [];
  try {
    validateBlocks(draft.blocks);
  } catch (error) {
    domainBlockErrors = [
      error instanceof Error ? error.message : "Invalid blocks",
    ];
    draft.errors.push({
      code: "DOMAIN_BLOCK_VALIDATION",
      message: "Блоки не прошли доменную валидацию",
      context: { details: domainBlockErrors.slice(0, 5) },
    });
  }

  const checksum = checksumArticleImportDraft(draft);
  draft.sourceReference = {
    ...draft.sourceReference,
    checksum,
  };

  let diff = null;
  if (input.targetArticleId) {
    const article = await ports.content.articles.getById(input.targetArticleId);
    if (!article) {
      throw new NotFoundError("Target article not found", {
        articleId: input.targetArticleId,
      });
    }
    diff = structuralDiffArticle(article, draft);
  }

  const now = ports.content.clock.now();
  const status = draft.errors.length > 0 ? "invalid" : "ready";
  const preview = {
    kind: "google-docs-article",
    draft: {
      proposedTitle: draft.proposedTitle,
      proposedSlug: draft.proposedSlug,
      proposedSummary: draft.proposedSummary,
      blocks: draft.blocks,
      unsupportedElements: draft.unsupportedElements,
      documentMetadata: draft.documentMetadata,
      sourceReference: draft.sourceReference,
    },
    diff,
    portalRevision: null as number | null,
    googleSourceVersion: metadata.version,
    googleModifiedAt: metadata.modifiedTime,
    normalizedChecksum: checksum,
  };

  if (input.targetArticleId) {
    const article = await ports.content.articles.getById(input.targetArticleId);
    preview.portalRevision = article?.revision ?? null;
  }

  assertPreviewSize(preview);

  const job = parseImportJob({
    id: ports.content.ids.next("import"),
    sourceConnectionId: source.id,
    sourceExternalId: source.externalId,
    sourceVersion: metadata.version,
    sourceModifiedAt: metadata.modifiedTime,
    sourceChecksum: checksum,
    importType: "google-docs-article",
    targetEntityType: "article",
    targetEntityId: input.targetArticleId ?? null,
    status,
    preview,
    warnings: draft.warnings,
    errors: draft.errors,
    createdBy: input.actorId,
    createdAt: now,
    expiresAt: previewExpiresAt(ports),
    confirmedAt: null,
    confirmedBy: null,
    resultEntityIds: [],
    idempotencyKey: null,
  });

  const saved = await ports.importJobs.save(job);
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.import.preview_created",
      entityType: "import-job",
      entityId: saved.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        sourceType: "google-docs",
        targetType: "article",
        warningCount: saved.warnings.length,
        errorCount: saved.errors.length,
      },
    }),
  );
  return saved;
}

export async function createSheetsImportPreview(
  ports: IntegrationPorts,
  input: {
    actorId: string;
    requestId: string;
    sourceId: string;
    dataSheetName?: string;
  },
) {
  const source = await ports.sources.getById(input.sourceId);
  if (!source) {
    throw new NotFoundError("Source connection not found", {
      sourceId: input.sourceId,
    });
  }
  if (source.status === "archived") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Archived source cannot create preview",
    );
  }
  if (source.mimeType !== GOOGLE_DRIVE_MIME_TYPES.spreadsheet) {
    throw new GoogleWorkspaceError(
      "GOOGLE_UNSUPPORTED_FILE_TYPE",
      "Source is not a Google Sheet",
    );
  }

  const policy = new GoogleDriveBoundaryPolicy(ports.google.drive, ports.config);
  const metadata = await policy.verifyFileForImport(source.externalId);
  const sheetMeta = await ports.google.sheets.getSpreadsheetMetadata(metadata.id);

  const ranges: string[] = [];
  if (sheetMeta.sheetNames.includes(PORTAL_SCHEMA_SHEET_NAME)) {
    ranges.push(`${PORTAL_SCHEMA_SHEET_NAME}!A1:B20`);
  }

  const dataSheet =
    input.dataSheetName ??
    sheetMeta.sheetNames.find((n) => n !== PORTAL_SCHEMA_SHEET_NAME) ??
    sheetMeta.sheetNames[0];

  if (!dataSheet) {
    throw new GoogleWorkspaceError(
      "GOOGLE_SHEET_SCHEMA_INVALID",
      "Spreadsheet has no sheets",
    );
  }

  // Peek marker to resolve data sheet if present
  let markerRows: string[][] | undefined;
  if (ranges.length > 0) {
    const markerValues = await ports.google.sheets.batchGetValues(metadata.id, {
      ranges,
    });
    markerRows = markerValues[0]?.values ?? [];
  }

  const batch = await ports.google.sheets.batchGetValues(metadata.id, {
    ranges: [`${dataSheet}!A1:ZZ`],
  });
  const rows = batch[0]?.values ?? [];

  const taxonomyLimit = CONTENT_LIMITS.listMaxLimit;
  const [categories, tags, audiences] = await Promise.all([
    ports.content.categories.list({ limit: taxonomyLimit }),
    ports.content.tags.list({ limit: taxonomyLimit }),
    ports.content.audiences.list({ limit: taxonomyLimit }),
  ]);

  // Source-scoped matching: do not depend on a truncated admin list.
  const sheetExternalIds = collectSheetExternalIds(rows);
  const existingByExternalId = new Map<
    string,
    { id: string; slug: string; revision: number }
  >();
  const existingSlugs = new Set<string>();
  for (const externalId of sheetExternalIds) {
    const found = await ports.content.prompts.findBySourceExternalId({
      sourceType: "google-sheets",
      connectionId: source.id,
      externalId,
    });
    if (found) {
      existingByExternalId.set(externalId, {
        id: found.id,
        slug: found.slug,
        revision: found.revision,
      });
      existingSlugs.add(found.slug);
    }
  }

  const parsed = parsePromptSheet({
    spreadsheetId: metadata.id,
    dataSheetName: dataSheet,
    rows,
    markerSheetRows: markerRows,
    existingByExternalId,
    existingSlugs,
    categories: categories.items.map((c) => ({
      id: c.id,
      name: c.title,
      slug: c.slug,
      status: c.status === "archived" ? "archived" : "active",
    })),
    tags: tags.items.map((c) => ({
      id: c.id,
      name: c.title,
      slug: c.slug,
      status: c.status === "archived" ? "archived" : "active",
    })),
    audiences: audiences.items.map((c) => ({
      id: c.id,
      name: c.title,
      slug: c.slug,
      status: c.status === "archived" ? "archived" : "active",
    })),
  });

  const now = ports.content.clock.now();
  const status = parsed.errors.length > 0 ? "invalid" : "ready";

  // Keep preview compact: store row summaries, not full prompt text beyond limit
  const preview = {
    kind: "google-sheets-prompts",
    sheetNames: sheetMeta.sheetNames,
    dataSheet,
    metrics: parsed.metrics,
    schemaVersion: parsed.schemaVersion,
    headers: parsed.headers,
    items: parsed.items.map((item) => ({
      ...item,
      promptText:
        item.promptText.length > 500
          ? `${item.promptText.slice(0, 500)}…`
          : item.promptText,
      _fullPromptText: item.promptText,
    })),
    googleSourceVersion: metadata.version,
    googleModifiedAt: metadata.modifiedTime,
    normalizedChecksum: parsed.checksum,
  };

  assertPreviewSize(preview);

  const job = parseImportJob({
    id: ports.content.ids.next("import"),
    sourceConnectionId: source.id,
    sourceExternalId: source.externalId,
    sourceVersion: metadata.version,
    sourceModifiedAt: metadata.modifiedTime,
    sourceChecksum: parsed.checksum,
    importType: "google-sheets-prompts",
    targetEntityType: "prompt-batch",
    targetEntityId: null,
    status,
    preview,
    warnings: parsed.warnings.slice(
      0,
      GOOGLE_WORKSPACE_LIMITS.MAX_IMPORT_WARNINGS,
    ),
    errors: parsed.errors.slice(0, GOOGLE_WORKSPACE_LIMITS.MAX_IMPORT_ERRORS),
    createdBy: input.actorId,
    createdAt: now,
    expiresAt: previewExpiresAt(ports),
    confirmedAt: null,
    confirmedBy: null,
    resultEntityIds: [],
    idempotencyKey: null,
  });

  const saved = await ports.importJobs.save(job);
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.import.preview_created",
      entityType: "import-job",
      entityId: saved.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        sourceType: "google-sheets",
        targetType: "prompt-batch",
        warningCount: saved.warnings.length,
        errorCount: saved.errors.length,
        rowCount: parsed.metrics.total,
      },
    }),
  );
  return saved;
}
