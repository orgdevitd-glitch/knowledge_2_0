import "server-only";

import { createAuditEvent } from "@/domain/content/audit";
import {
  isImportJobExpired,
  parseImportJob,
  type ImportJob,
} from "@/domain/integrations/import-job";
import { parseSourceConnection } from "@/domain/integrations/source-connection";
import { parseSourceReference } from "@/domain/content/source";
import { NotFoundError } from "@/domain/shared/errors";
import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import {
  createArticleUseCase,
  replaceArticleBlocks,
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import {
  createPromptUseCase,
  updatePrompt,
} from "@/features/content/application/prompt-use-cases";
import type { ContentBlock } from "@/domain/content/blocks";

import { buildImportIdempotencyKey } from "./idempotency";
import type { IntegrationPorts } from "./ports";

export type DocsConfirmMode = "metadata" | "blocks" | "both";

export type ConfirmDocsImportInput = {
  actorId: string;
  requestId: string;
  importJobId: string;
  mode: DocsConfirmMode;
  createNew: boolean;
  targetArticleId?: string | null;
  title?: string;
  slug?: string;
  summary?: string;
};

export type ConfirmSheetsImportInput = {
  actorId: string;
  requestId: string;
  importJobId: string;
  /** When true, import only ready/warning rows; skip error rows. */
  readyOnly: boolean;
};

async function assertJobConfirmable(
  ports: IntegrationPorts,
  job: ImportJob,
): Promise<void> {
  if (job.status === "confirmed") {
    throw new GoogleWorkspaceError(
      "IMPORT_ALREADY_CONFIRMED",
      "Import already confirmed",
    );
  }
  if (job.status === "cancelled") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import was cancelled",
    );
  }
  if (isImportJobExpired(job) || job.status === "expired") {
    throw new GoogleWorkspaceError(
      "IMPORT_PREVIEW_EXPIRED",
      "Import preview has expired",
    );
  }
  if (job.status === "invalid" || job.status === "failed") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import preview is invalid",
    );
  }
  if (!job.sourceConnectionId) {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import job has no source connection",
    );
  }

  const source = await ports.sources.getById(job.sourceConnectionId);
  if (!source || source.status === "archived") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Source connection is unavailable",
    );
  }

  const policy = new GoogleDriveBoundaryPolicy(ports.google.drive, ports.config);
  const metadata = await policy.verifyFileForImport(job.sourceExternalId);
  if (
    (metadata.version ?? null) !== (job.sourceVersion ?? null) ||
    (metadata.modifiedTime ?? null) !== (job.sourceModifiedAt ?? null)
  ) {
    throw new GoogleWorkspaceError(
      "IMPORT_SOURCE_CHANGED",
      "Google source changed after preview; create a new preview",
    );
  }
}

export async function confirmDocsImport(
  ports: IntegrationPorts,
  input: ConfirmDocsImportInput,
): Promise<{
  job: ImportJob;
  articleId: string;
  replayed: boolean;
}> {
  const existingJob = await ports.importJobs.getById(input.importJobId);
  if (!existingJob) {
    throw new NotFoundError("Import job not found", {
      importJobId: input.importJobId,
    });
  }

  const targetId = input.createNew
    ? null
    : (input.targetArticleId ?? existingJob.targetEntityId);
  const idempotencyKey = buildImportIdempotencyKey({
    importJobId: existingJob.id,
    sourceExternalId: existingJob.sourceExternalId,
    sourceVersion: existingJob.sourceVersion,
    targetEntityType: "article",
    targetEntityId: targetId,
    operation: `confirm-docs:${input.mode}`,
  });

  const prior = await ports.idempotency.getByKey(idempotencyKey);
  if (prior) {
    const job = await ports.importJobs.getById(existingJob.id);
    return {
      job: job ?? existingJob,
      articleId: String(prior.result.articleId ?? ""),
      replayed: true,
    };
  }

  if (existingJob.status === "confirmed") {
    throw new GoogleWorkspaceError(
      "IMPORT_ALREADY_CONFIRMED",
      "Import already confirmed",
    );
  }

  await assertJobConfirmable(ports, existingJob);

  if (existingJob.importType !== "google-docs-article") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import job type mismatch",
    );
  }

  const preview = existingJob.preview as {
    draft?: {
      proposedTitle: string;
      proposedSlug: string;
      proposedSummary: string;
      blocks: ContentBlock[];
      sourceReference: Record<string, unknown>;
    };
    portalRevision?: number | null;
  } | null;

  if (!preview?.draft) {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Preview payload missing",
    );
  }

  const ctx = { actorId: input.actorId, requestId: input.requestId };
  const now = ports.content.clock.now();
  let articleId: string;

  if (input.createNew || !targetId) {
    const title = input.title ?? preview.draft.proposedTitle;
    const slug = input.slug ?? preview.draft.proposedSlug;
    const summary = input.summary ?? preview.draft.proposedSummary ?? "";
    const created = await createArticleUseCase(ports.content, ctx, {
      slug,
      title,
      summary,
      ownerId: input.actorId,
      source: parseSourceReference(preview.draft.sourceReference),
    });
    articleId = created.id;
    if (input.mode === "blocks" || input.mode === "both") {
      await replaceArticleBlocks(
        ports.content,
        ctx,
        created.id,
        created.revision,
        preview.draft.blocks,
      );
    }
  } else {
    const article = await ports.content.articles.getById(targetId);
    if (!article) {
      throw new NotFoundError("Target article not found", {
        articleId: targetId,
      });
    }
    if (
      preview.portalRevision !== null &&
      preview.portalRevision !== undefined &&
      article.revision !== preview.portalRevision
    ) {
      throw new GoogleWorkspaceError(
        "IMPORT_TARGET_CHANGED",
        "Target article changed after preview",
      );
    }

    // Published articles keep public snapshot; we only mutate working draft fields.
    let revision = article.revision;
    articleId = article.id;

    if (input.mode === "metadata" || input.mode === "both") {
      const updated = await updateArticleMetadata(
        ports.content,
        ctx,
        article.id,
        revision,
        {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          source: parseSourceReference(preview.draft.sourceReference),
        },
      );
      revision = updated.revision;
    }

    if (input.mode === "blocks" || input.mode === "both") {
      await replaceArticleBlocks(
        ports.content,
        ctx,
        article.id,
        revision,
        preview.draft.blocks,
      );
    }
  }

  const source = await ports.sources.getById(existingJob.sourceConnectionId!);
  if (source) {
    const updatedSource = parseSourceConnection({
      ...source,
      targetEntityType: "article",
      targetEntityId: articleId,
      lastImportedChecksum: existingJob.sourceChecksum,
      lastImportedAt: now,
      lastKnownModifiedAt: existingJob.sourceModifiedAt,
      lastKnownVersion: existingJob.sourceVersion,
      updatedAt: now,
      revision: source.revision + 1,
    });
    await ports.sources.save(updatedSource, source.revision);
  }

  const confirmed = parseImportJob({
    ...existingJob,
    status: "confirmed",
    confirmedAt: now,
    confirmedBy: input.actorId,
    resultEntityIds: [articleId],
    targetEntityId: articleId,
    idempotencyKey,
    preview: existingJob.preview,
  });
  const savedJob = await ports.importJobs.save(confirmed);

  await ports.idempotency.saveIfAbsent({
    idempotencyKey,
    operation: "confirm-docs",
    result: { articleId, importJobId: savedJob.id },
    createdAt: now,
  });

  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.import.confirmed",
      entityType: "import-job",
      entityId: savedJob.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        targetType: "article",
        count: 1,
        mode: input.mode,
      },
    }),
  );
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "article.imported",
      entityType: "article",
      entityId: articleId,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        importJobId: savedJob.id,
      },
    }),
  );

  return { job: savedJob, articleId, replayed: false };
}

export async function confirmSheetsImport(
  ports: IntegrationPorts,
  input: ConfirmSheetsImportInput,
): Promise<{
  job: ImportJob;
  promptIds: string[];
  skippedRows: number[];
  replayed: boolean;
}> {
  const existingJob = await ports.importJobs.getById(input.importJobId);
  if (!existingJob) {
    throw new NotFoundError("Import job not found", {
      importJobId: input.importJobId,
    });
  }

  const idempotencyKey = buildImportIdempotencyKey({
    importJobId: existingJob.id,
    sourceExternalId: existingJob.sourceExternalId,
    sourceVersion: existingJob.sourceVersion,
    targetEntityType: "prompt-batch",
    targetEntityId: null,
    operation: `confirm-sheets:${input.readyOnly ? "ready-only" : "all"}`,
  });

  const prior = await ports.idempotency.getByKey(idempotencyKey);
  if (prior) {
    const job = await ports.importJobs.getById(existingJob.id);
    return {
      job: job ?? existingJob,
      promptIds: Array.isArray(prior.result.promptIds)
        ? (prior.result.promptIds as string[])
        : [],
      skippedRows: Array.isArray(prior.result.skippedRows)
        ? (prior.result.skippedRows as number[])
        : [],
      replayed: true,
    };
  }

  await assertJobConfirmable(ports, existingJob);

  if (existingJob.importType !== "google-sheets-prompts") {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import job type mismatch",
    );
  }

  const preview = existingJob.preview as {
    items?: Array<{
      rowNumber: number;
      externalId: string;
      title: string;
      proposedSlug: string;
      promptText: string;
      _fullPromptText?: string;
      summary: string | null;
      categoryTokens: Array<{ status: string; matchedId?: string }>;
      tagTokens: Array<{ status: string; matchedId?: string }>;
      audienceTokens: Array<{ status: string; matchedId?: string }>;
      inputRequirements: string | null;
      outputRequirements: string | null;
      restrictions: string | null;
      usageExample: string | null;
      reviewDueAt: string | null;
      status: string;
      action: string;
      existingPromptId: string | null;
    }>;
  } | null;

  const items = preview?.items ?? [];
  const errorRows = items.filter((i) => i.status === "error");
  if (errorRows.length > 0 && !input.readyOnly) {
    throw new GoogleWorkspaceError(
      "IMPORT_VALIDATION_FAILED",
      "Import has row errors; choose ready-only mode or fix rows",
      { errorCount: errorRows.length },
    );
  }

  const ctx = { actorId: input.actorId, requestId: input.requestId };
  const now = ports.content.clock.now();
  const promptIds: string[] = [];
  const skippedRows: number[] = [];

  const importable = items.filter((i) =>
    input.readyOnly
      ? i.status === "ready" || i.status === "warning"
      : i.status !== "error",
  );

  for (const item of items) {
    if (!importable.includes(item)) {
      skippedRows.push(item.rowNumber);
    }
  }

  // Chunked sequential saves (deterministic). Not a single multi-entity Firestore
  // transaction when batch is large — progress recorded on the job at the end.
  for (const item of importable) {
    const resolvedCategories = item.categoryTokens
      .filter((t) => t.status === "resolved" && t.matchedId)
      .map((t) => t.matchedId!);
    const resolvedTags = item.tagTokens
      .filter((t) => t.status === "resolved" && t.matchedId)
      .map((t) => t.matchedId!);
    const resolvedAudiences = item.audienceTokens
      .filter((t) => t.status === "resolved" && t.matchedId)
      .map((t) => t.matchedId!);

    const promptText = item._fullPromptText ?? item.promptText;
    const source = parseSourceReference({
      type: "google-sheets",
      externalId: item.externalId,
      checksum: existingJob.sourceChecksum ?? undefined,
      lastKnownModifiedAt: existingJob.sourceModifiedAt ?? undefined,
      lastSyncAt: now,
    });

    if (item.existingPromptId && item.action === "update") {
      const existing = await ports.content.prompts.getById(item.existingPromptId);
      if (!existing) {
        skippedRows.push(item.rowNumber);
        continue;
      }
      if (existing.status === "published") {
        // Only update working draft fields; never auto-publish.
      }
      const updated = await updatePrompt(
        ports.content,
        ctx,
        existing.id,
        existing.revision,
        {
          title: item.title,
          summary: item.summary,
          promptText,
          categoryIds: resolvedCategories,
          tagIds: resolvedTags,
          audienceIds: resolvedAudiences,
          inputRequirements: item.inputRequirements,
          outputRequirements: item.outputRequirements,
          restrictions: item.restrictions,
          usageExample: item.usageExample,
          reviewDueAt: item.reviewDueAt,
          source,
        },
      );
      promptIds.push(updated.id);
    } else {
      const created = await createPromptUseCase(ports.content, ctx, {
        slug: item.proposedSlug,
        title: item.title,
        summary: item.summary,
        promptText,
        categoryIds: resolvedCategories,
        tagIds: resolvedTags,
        audienceIds: resolvedAudiences,
        inputRequirements: item.inputRequirements,
        outputRequirements: item.outputRequirements,
        restrictions: item.restrictions,
        usageExample: item.usageExample,
        reviewDueAt: item.reviewDueAt,
        ownerId: input.actorId,
        source,
      });
      promptIds.push(created.id);
    }
  }

  const sourceConn = await ports.sources.getById(existingJob.sourceConnectionId!);
  if (sourceConn) {
    await ports.sources.save(
      parseSourceConnection({
        ...sourceConn,
        targetEntityType: "prompt-batch",
        lastImportedChecksum: existingJob.sourceChecksum,
        lastImportedAt: now,
        lastKnownModifiedAt: existingJob.sourceModifiedAt,
        lastKnownVersion: existingJob.sourceVersion,
        updatedAt: now,
        revision: sourceConn.revision + 1,
      }),
      sourceConn.revision,
    );
  }

  const confirmed = parseImportJob({
    ...existingJob,
    status: "confirmed",
    confirmedAt: now,
    confirmedBy: input.actorId,
    resultEntityIds: promptIds.slice(0, 100),
    idempotencyKey,
  });
  const savedJob = await ports.importJobs.save(confirmed);

  await ports.idempotency.saveIfAbsent({
    idempotencyKey,
    operation: "confirm-sheets",
    result: { promptIds, skippedRows, importJobId: savedJob.id },
    createdAt: now,
  });

  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.import.confirmed",
      entityType: "import-job",
      entityId: savedJob.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        targetType: "prompt-batch",
        count: promptIds.length,
        skipped: skippedRows.length,
        readyOnly: input.readyOnly,
      },
    }),
  );
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "prompt.batch_imported",
      entityType: "prompt",
      entityId: promptIds[0] ?? savedJob.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        importJobId: savedJob.id,
        resultIds: promptIds.slice(0, 20),
        count: promptIds.length,
      },
    }),
  );

  return { job: savedJob, promptIds, skippedRows, replayed: false };
}
