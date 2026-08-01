import { beforeEach, describe, expect, it } from "vitest";

import { SystemClock } from "@/domain/shared/clock";
import { createArticle } from "@/domain/content/article";
import { MemoryArticleRepository } from "@/server/repositories/memory/memory-article-repository";
import { MemoryPromptRepository } from "@/server/repositories/memory/memory-prompt-repository";
import { MemoryAuditRepository } from "@/server/repositories/memory/memory-audit-repository";
import {
  MemoryAudienceRepository,
  MemoryCategoryRepository,
  MemoryTagRepository,
} from "@/server/repositories/memory/memory-taxonomy-repository";
import { MemoryVersionRepository } from "@/server/repositories/memory/memory-version-repository";
import { MemoryVideoRepository } from "@/server/repositories/memory/memory-video-repository";
import { MemoryPromptUnitOfWork } from "@/server/repositories/memory/memory-prompt-unit-of-work";
import {
  MemoryIdempotencyRepository,
} from "@/server/repositories/memory/memory-idempotency-repository";
import { MemoryImportJobRepository } from "@/server/repositories/memory/memory-import-job-repository";
import { MemorySourceConnectionRepository } from "@/server/repositories/memory/memory-source-connection-repository";
import { FakeGoogleDriveAdapter } from "@/server/google-workspace/testing/fake-drive";
import { FakeGoogleDocsAdapter } from "@/server/google-workspace/testing/fake-docs";
import { FakeGoogleSheetsAdapter } from "@/server/google-workspace/testing/fake-sheets";
import { GOOGLE_DRIVE_MIME_TYPES } from "@/server/google-workspace/ports";
import { createSourceConnection } from "@/features/integrations/google/application/create-source-connection";
import { createDocsImportPreview } from "@/features/integrations/google/application/create-import-preview";
import { confirmDocsImport } from "@/features/integrations/google/application/confirm-import";
import { buildImportIdempotencyKey } from "@/features/integrations/google/application/idempotency";
import type { IntegrationPorts } from "@/features/integrations/google/application/ports";
import type { ContentPorts } from "@/features/content/application/ports";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import { parseImportJob } from "@/domain/integrations/import-job";
import {
  publishArticle,
  replaceArticleBlocks,
} from "@/features/content/application/article-use-cases";
import { articleFromPublishedSnapshot } from "@/domain/content/article";

const SHARED = "shared-drive-1234567890";
const ROOT = "root-folder-1234567890";
const DOC_ID = "doc-import-test-001";

function ids() {
  let n = 0;
  return {
    next(prefix = "id") {
      n += 1;
      return `${prefix}_${n}`;
    },
  };
}

function buildPorts(): IntegrationPorts {
  const drive = new FakeGoogleDriveAdapter([
    {
      id: ROOT,
      name: "Root",
      mimeType: GOOGLE_DRIVE_MIME_TYPES.folder,
      modifiedTime: "2026-01-01T00:00:00.000Z",
      createdTime: "2026-01-01T00:00:00.000Z",
      parents: [],
      driveId: SHARED,
      trashed: false,
      size: null,
      version: "1",
      webViewLink: null,
      canDownload: false,
      children: [DOC_ID],
    },
    {
      id: DOC_ID,
      name: "Doc One",
      mimeType: GOOGLE_DRIVE_MIME_TYPES.document,
      modifiedTime: "2026-01-02T00:00:00.000Z",
      createdTime: "2026-01-01T00:00:00.000Z",
      parents: [ROOT],
      driveId: SHARED,
      trashed: false,
      size: null,
      version: "3",
      webViewLink: `https://docs.google.com/document/d/${DOC_ID}/edit`,
      canDownload: true,
    },
  ]);
  const docs = new FakeGoogleDocsAdapter([
    {
      id: DOC_ID,
      title: "Импорт статья",
      body: {
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "HEADING_1" },
              elements: [
                { textRun: { content: "Раздел\n", textStyle: {} } },
              ],
            },
          },
          {
            paragraph: {
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
              elements: [
                { textRun: { content: "Текст абзаца\n", textStyle: {} } },
              ],
            },
          },
        ],
      },
    },
  ]);

  const prompts = new MemoryPromptRepository();
  const versions = new MemoryVersionRepository();
  const audit = new MemoryAuditRepository();
  const content: ContentPorts = {
    articles: new MemoryArticleRepository(),
    prompts,
    videos: new MemoryVideoRepository(),
    categories: new MemoryCategoryRepository(),
    tags: new MemoryTagRepository(),
    audiences: new MemoryAudienceRepository(),
    versions,
    audit,
    clock: new SystemClock(),
    ids: ids(),
    uow: new MemoryPromptUnitOfWork(prompts, versions, audit),
  };

  return {
    google: { drive, docs, sheets: new FakeGoogleSheetsAdapter() },
    sources: new MemorySourceConnectionRepository(),
    importJobs: new MemoryImportJobRepository(),
    idempotency: new MemoryIdempotencyRepository(),
    content,
    config: {
      mode: "service-account",
      sharedDriveId: SHARED,
      rootFolderId: ROOT,
      allowedFolderIds: [],
      maxFileSizeBytes: 25_000_000,
      importPreviewTtlSeconds: 3600,
      requestTimeoutMs: 30_000,
      maxRetryAttempts: 3,
    },
  };
}

describe("import preview and confirm", () => {
  let ports: IntegrationPorts;

  beforeEach(() => {
    ports = buildPorts();
  });

  it("creates docs preview and confirms into draft article idempotently", async () => {
    const source = await createSourceConnection(ports, {
      actorId: "user_admin1",
      requestId: "req1",
      urlOrId: DOC_ID,
      targetEntityType: "article",
    });
    const job = await createDocsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req2",
      sourceId: source.id,
    });
    expect(job.status).toBe("ready");

    const first = await confirmDocsImport(ports, {
      actorId: "user_admin1",
      requestId: "req3",
      importJobId: job.id,
      mode: "both",
      createNew: true,
    });
    expect(first.replayed).toBe(false);
    const article = await ports.content.articles.getById(first.articleId);
    expect(article?.status).toBe("draft");
    expect(article?.blocks.length).toBeGreaterThan(0);

    const second = await confirmDocsImport(ports, {
      actorId: "user_admin1",
      requestId: "req4",
      importJobId: job.id,
      mode: "both",
      createNew: true,
    });
    expect(second.replayed).toBe(true);
    expect(second.articleId).toBe(first.articleId);
  });

  it("blocks confirm when source version changes", async () => {
    const source = await createSourceConnection(ports, {
      actorId: "user_admin1",
      requestId: "req1",
      urlOrId: DOC_ID,
      targetEntityType: "article",
    });
    const job = await createDocsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req2",
      sourceId: source.id,
    });

    // mutate fake drive version
    const drive = ports.google.drive as FakeGoogleDriveAdapter;
    drive.seed({
      id: DOC_ID,
      name: "Doc One",
      mimeType: GOOGLE_DRIVE_MIME_TYPES.document,
      modifiedTime: "2026-01-03T00:00:00.000Z",
      createdTime: "2026-01-01T00:00:00.000Z",
      parents: [ROOT],
      driveId: SHARED,
      trashed: false,
      size: null,
      version: "99",
      webViewLink: null,
      canDownload: true,
    });

    await expect(
      confirmDocsImport(ports, {
        actorId: "user_admin1",
        requestId: "req3",
        importJobId: job.id,
        mode: "both",
        createNew: true,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_SOURCE_CHANGED" });
  });

  it("blocks confirm when target article revision changes after preview", async () => {
    const now = ports.content.clock.now();
    const article = createArticle({
      id: "article_target1",
      slug: "target-one",
      title: "Target",
      summary: "summary",
      now,
      ownerId: "user_admin1",
    });
    await ports.content.articles.save(article, { expectedRevision: 0 });

    const source = await createSourceConnection(ports, {
      actorId: "user_admin1",
      requestId: "req1",
      urlOrId: DOC_ID,
      targetEntityType: "article",
    });
    const job = await createDocsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req2",
      sourceId: source.id,
      targetArticleId: article.id,
    });
    expect(
      (job.preview as { portalRevision?: number | null } | null)?.portalRevision,
    ).toBe(0);

    await replaceArticleBlocks(
      ports.content,
      { actorId: "user_admin1", requestId: "mutate" },
      article.id,
      0,
      [
        {
          id: "blk_mutated",
          type: "paragraph",
          schemaVersion: 1,
          settings: {},
          visibility: "all",
          data: {
            content: {
              schemaVersion: 1,
              nodes: [{ type: "text", text: "Changed after preview" }],
            },
          },
        },
      ],
    );

    await expect(
      confirmDocsImport(ports, {
        actorId: "user_admin1",
        requestId: "req3",
        importJobId: job.id,
        mode: "both",
        createNew: false,
        targetArticleId: article.id,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_TARGET_CHANGED" });
  });

  it("rejects expired preview and confirm with different parameters after confirm", async () => {
    const source = await createSourceConnection(ports, {
      actorId: "user_admin1",
      requestId: "req1",
      urlOrId: DOC_ID,
      targetEntityType: "article",
    });
    const job = await createDocsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req2",
      sourceId: source.id,
    });
    const expired = parseImportJob({
      ...job,
      expiresAt: "2000-01-01T00:00:00.000Z",
    });
    await ports.importJobs.save(expired);
    await expect(
      confirmDocsImport(ports, {
        actorId: "user_admin1",
        requestId: "req3",
        importJobId: job.id,
        mode: "both",
        createNew: true,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_PREVIEW_EXPIRED" });

    const fresh = await createDocsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req4",
      sourceId: source.id,
    });
    await confirmDocsImport(ports, {
      actorId: "user_admin1",
      requestId: "req5",
      importJobId: fresh.id,
      mode: "both",
      createNew: true,
    });
    await expect(
      confirmDocsImport(ports, {
        actorId: "user_admin1",
        requestId: "req6",
        importJobId: fresh.id,
        mode: "metadata",
        createNew: true,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_ALREADY_CONFIRMED" });
  });

  it("does not change public published snapshot when updating working draft", async () => {
    const now = ports.content.clock.now();
    const article = createArticle({
      id: "article_pub1",
      slug: "published-one",
      title: "Published",
      summary: "summary",
      now,
      ownerId: "user_admin1",
    });
    await ports.content.articles.save(article, { expectedRevision: 0 });
    const withBlocks = await replaceArticleBlocks(
      ports.content,
      { actorId: "user_admin1", requestId: "r0" },
      article.id,
      0,
      [
        {
          id: "blk_0001",
          type: "paragraph",
          schemaVersion: 1,
          settings: {},
          visibility: "all",
          data: {
            content: {
              schemaVersion: 1,
              nodes: [{ type: "text", text: "Published body" }],
            },
          },
        },
      ],
    );
    const published = await publishArticle(
      ports.content,
      { actorId: "user_admin1", requestId: "r1" },
      withBlocks.id,
      withBlocks.revision,
    );

    const source = await createSourceConnection(ports, {
      actorId: "user_admin1",
      requestId: "req1",
      urlOrId: DOC_ID,
      targetEntityType: "article",
    });
    const job = await createDocsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req2",
      sourceId: source.id,
      targetArticleId: published.article.id,
    });
    await confirmDocsImport(ports, {
      actorId: "user_admin1",
      requestId: "req3",
      importJobId: job.id,
      mode: "blocks",
      createNew: false,
      targetArticleId: published.article.id,
    });

    const latest = await ports.content.articles.getById(published.article.id);
    expect(latest?.status).toBe("published");
    const version = await ports.content.versions.getById(
      latest!.publishedVersion!,
    );
    expect(version).toBeTruthy();
    const publicArticle = articleFromPublishedSnapshot(
      latest!,
      version!.snapshot as never,
    );
    expect(
      publicArticle.blocks.some((b) => {
        if (b.type !== "paragraph") return false;
        const text = JSON.stringify(b.data);
        return text.includes("Published body");
      }),
    ).toBe(true);
  });
});

const SHEET_ID = "sheet-import-test-001";

function buildSheetsPorts(): IntegrationPorts {
  const drive = new FakeGoogleDriveAdapter([
    {
      id: ROOT,
      name: "Root",
      mimeType: GOOGLE_DRIVE_MIME_TYPES.folder,
      modifiedTime: "2026-01-01T00:00:00.000Z",
      createdTime: "2026-01-01T00:00:00.000Z",
      parents: [],
      driveId: SHARED,
      trashed: false,
      size: null,
      version: "1",
      webViewLink: null,
      canDownload: false,
      children: [SHEET_ID],
    },
    {
      id: SHEET_ID,
      name: "Prompts Sheet",
      mimeType: GOOGLE_DRIVE_MIME_TYPES.spreadsheet,
      modifiedTime: "2026-01-02T00:00:00.000Z",
      createdTime: "2026-01-01T00:00:00.000Z",
      parents: [ROOT],
      driveId: SHARED,
      trashed: false,
      size: null,
      version: "5",
      webViewLink: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
      canDownload: true,
    },
  ]);
  const sheets = new FakeGoogleSheetsAdapter([
    {
      id: SHEET_ID,
      title: "Prompts Sheet",
      sheetNames: ["Промты"],
      modifiedTime: "2026-01-02T00:00:00.000Z",
      version: "5",
      valuesByRange: {
        "Промты!A1:ZZ": [
          ["Внешний ID", "Название", "Текст промта"],
          ["ext-prompt-1", "Промт один", "Сделай X"],
        ],
      },
    },
  ]);
  const prompts = new MemoryPromptRepository();
  const versions = new MemoryVersionRepository();
  const audit = new MemoryAuditRepository();
  const content: ContentPorts = {
    articles: new MemoryArticleRepository(),
    prompts,
    videos: new MemoryVideoRepository(),
    categories: new MemoryCategoryRepository(),
    tags: new MemoryTagRepository(),
    audiences: new MemoryAudienceRepository(),
    versions,
    audit,
    clock: new SystemClock(),
    ids: ids(),
    uow: new MemoryPromptUnitOfWork(prompts, versions, audit),
  };
  return {
    google: {
      drive,
      docs: new FakeGoogleDocsAdapter(),
      sheets,
    },
    sources: new MemorySourceConnectionRepository(),
    importJobs: new MemoryImportJobRepository(),
    idempotency: new MemoryIdempotencyRepository(),
    content,
    config: {
      mode: "service-account",
      sharedDriveId: SHARED,
      rootFolderId: ROOT,
      allowedFolderIds: [],
      maxFileSizeBytes: 25_000_000,
      importPreviewTtlSeconds: 3600,
      requestTimeoutMs: 30_000,
      maxRetryAttempts: 3,
    },
  };
}

describe("sheets import preview and confirm", () => {
  let ports: IntegrationPorts;

  beforeEach(() => {
    ports = buildSheetsPorts();
  });

  it("creates sheets preview and confirms draft prompts idempotently", async () => {
    const { createSheetsImportPreview } = await import(
      "@/features/integrations/google/application/create-import-preview"
    );
    const { confirmSheetsImport } = await import(
      "@/features/integrations/google/application/confirm-import"
    );

    const source = await createSourceConnection(ports, {
      actorId: "user_admin1",
      requestId: "req1",
      urlOrId: SHEET_ID,
      targetEntityType: "prompt-batch",
    });
    expect(source.sourceType).toBe("google-sheets");

    const job = await createSheetsImportPreview(ports, {
      actorId: "user_admin1",
      requestId: "req2",
      sourceId: source.id,
    });
    expect(job.status).toBe("ready");
    expect(job.importType).toBe("google-sheets-prompts");
    expect(await ports.content.prompts.list({}, { limit: 10 })).toMatchObject({
      items: [],
    });

    const first = await confirmSheetsImport(ports, {
      actorId: "user_admin1",
      requestId: "req3",
      importJobId: job.id,
      readyOnly: false,
    });
    expect(first.replayed).toBe(false);
    expect(first.promptIds).toHaveLength(1);
    const prompt = await ports.content.prompts.getById(first.promptIds[0]!);
    expect(prompt?.status).toBe("draft");
    expect(prompt?.promptText).toContain("Сделай X");

    const second = await confirmSheetsImport(ports, {
      actorId: "user_admin1",
      requestId: "req4",
      importJobId: job.id,
      readyOnly: false,
    });
    expect(second.replayed).toBe(true);
    expect(second.promptIds).toEqual(first.promptIds);
    const listed = await ports.content.prompts.list({}, { limit: 50 });
    expect(listed.items.filter((p) => p.slug === prompt!.slug)).toHaveLength(1);
  });
});

describe("idempotency key", () => {
  it("is stable for same inputs", () => {
    const a = buildImportIdempotencyKey({
      importJobId: "j1",
      sourceExternalId: "s1",
      sourceVersion: "1",
      targetEntityType: "article",
      targetEntityId: null,
      operation: "confirm-docs:both",
    });
    const b = buildImportIdempotencyKey({
      importJobId: "j1",
      sourceExternalId: "s1",
      sourceVersion: "1",
      targetEntityType: "article",
      targetEntityId: null,
      operation: "confirm-docs:both",
    });
    expect(a).toBe(b);
  });
});

describe("GoogleWorkspaceError mapping", () => {
  it("exposes known codes", () => {
    const err = new GoogleWorkspaceError(
      "IMPORT_PREVIEW_EXPIRED",
      "expired",
    );
    expect(err.code).toBe("IMPORT_PREVIEW_EXPIRED");
  });
});
