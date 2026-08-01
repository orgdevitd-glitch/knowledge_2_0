import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createContentVersion } from "@/domain/content/versioning";
import { parseSourceReference } from "@/domain/content/source";
import { toPromptSnapshot } from "@/domain/content/prompt";
import {
  archivePrompt,
  createPromptUseCase,
  hidePrompt,
  publishPrompt,
  restoreArchivedPrompt,
  restorePromptVersion,
  updatePrompt,
} from "@/features/content/application/prompt-use-cases";
import {
  buildTaxonomyMaps,
  toPromptSummary,
} from "@/features/public-content/mappers";
import { buildCatalogPage, buildSearchDocuments } from "@/features/public-content/catalog";
import { createTestPorts, testCtx, TEST_NOW } from "../builders/content";

const sheetsSource = () =>
  parseSourceReference({
    type: "google-sheets",
    externalId: "row-provenance-1",
    connectionId: "src_conn_1",
    lastImportJobId: "import_job_1",
    lastSyncAt: "2024-06-15T12:00:00.000Z",
    checksum: "abc123checksum",
  });

describe("prompt provenance lifecycle", () => {
  it("imported draft keeps provenance after edit, publish, republish, hide, archive, restore", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "prov-life",
      title: "Provenance",
      promptText: "Sheet text v1",
      ownerId: "user_1",
      source: sheetsSource(),
    });

    const edited = await updatePrompt(ports, ctx, created.id, created.revision, {
      title: "Provenance edited",
      promptText: "Sheet text v2",
    });
    expect(edited.source).toMatchObject({
      type: "google-sheets",
      externalId: "row-provenance-1",
      connectionId: "src_conn_1",
      lastImportJobId: "import_job_1",
    });

    const pub1 = await publishPrompt(
      ports,
      ctx,
      edited.id,
      edited.revision,
      "v1",
    );
    expect(pub1.prompt.source.type).toBe("google-sheets");
    expect(pub1.prompt.source.externalId).toBe("row-provenance-1");
    expect(pub1.prompt.source.connectionId).toBe("src_conn_1");

    const version = await ports.versions.getById(pub1.versionId);
    expect(version?.source.type).toBe("portal");

    const draft = await updatePrompt(
      ports,
      ctx,
      pub1.prompt.id,
      pub1.prompt.revision,
      { promptText: "Sheet text v3" },
    );
    const pub2 = await publishPrompt(
      ports,
      ctx,
      draft.id,
      draft.revision,
      "v2",
    );
    expect(pub2.prompt.source.externalId).toBe("row-provenance-1");
    expect(pub2.prompt.source.connectionId).toBe("src_conn_1");

    const hidden = await hidePrompt(
      ports,
      ctx,
      pub2.prompt.id,
      pub2.prompt.revision,
    );
    expect(hidden.source.externalId).toBe("row-provenance-1");

    const archived = await archivePrompt(
      ports,
      ctx,
      hidden.id,
      hidden.revision,
    );
    expect(archived.source.connectionId).toBe("src_conn_1");

    const restored = await restoreArchivedPrompt(
      ports,
      ctx,
      archived.id,
      archived.revision,
    );
    expect(restored.source).toMatchObject({
      type: "google-sheets",
      externalId: "row-provenance-1",
      connectionId: "src_conn_1",
      lastImportJobId: "import_job_1",
    });
  });

  it("version restore does not replace entity provenance from snapshot", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "prov-ver",
      title: "V",
      promptText: "One",
      ownerId: "user_1",
      source: sheetsSource(),
    });
    const pub = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
      "v1",
    );
    const draft = await updatePrompt(
      ports,
      ctx,
      pub.prompt.id,
      pub.prompt.revision,
      { promptText: "Two", title: "V2" },
    );
    const again = await publishPrompt(
      ports,
      ctx,
      draft.id,
      draft.revision,
      "v2",
    );
    const vRestored = await restorePromptVersion(
      ports,
      ctx,
      again.prompt.id,
      pub.versionId,
      again.prompt.revision,
    );
    expect(vRestored.promptText).toBe("One");
    expect(vRestored.source.type).toBe("google-sheets");
    expect(vRestored.source.externalId).toBe("row-provenance-1");
    expect(vRestored.source.connectionId).toBe("src_conn_1");
    expect(toPromptSnapshot(vRestored)).not.toHaveProperty("source");
  });

  it("manual prompt has portal source without fake SourceConnection", async () => {
    const ports = createTestPorts();
    const created = await createPromptUseCase(ports, testCtx(), {
      slug: "manual-prov",
      title: "Manual",
      promptText: "Text",
      ownerId: "user_1",
    });
    expect(created.source.type).toBe("portal");
    expect(created.source.connectionId).toBeUndefined();
    expect(created.source.externalId).toBeUndefined();
  });

  it("rejects silent rewrite of import-managed externalId/connectionId", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "locked-ext",
      title: "Locked",
      promptText: "Text",
      ownerId: "user_1",
      source: sheetsSource(),
    });
    await expect(
      updatePrompt(ports, ctx, created.id, created.revision, {
        source: parseSourceReference({
          type: "google-sheets",
          externalId: "other-row",
          connectionId: "src_conn_1",
        }),
      }),
    ).rejects.toMatchObject({ details: { adminCode: "SOURCE_REFERENCE_INVALID" } });
  });

  it("public DTO / catalog / search do not expose admin provenance", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "public-prov",
      title: "Public Prov",
      promptText: "Visible text",
      ownerId: "user_1",
      source: sheetsSource(),
    });
    const pub = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
    );
    const version = await ports.versions.getById(pub.versionId);
    const { promptFromPublishedSnapshot } = await import(
      "@/domain/content/prompt"
    );
    const publicPrompt = promptFromPublishedSnapshot(
      pub.prompt,
      version!.snapshot as never,
    );
    const summary = toPromptSummary(
      publicPrompt,
      buildTaxonomyMaps([], [], []),
      TEST_NOW,
    );
    const page = buildCatalogPage(
      [],
      [publicPrompt],
      [],
      [],
      [],
      TEST_NOW,
      { type: "prompt" },
    );
    const docs = buildSearchDocuments([], [publicPrompt], [], [], []);
    const blob = JSON.stringify({ summary, page, docs, version: version?.snapshot });
    expect(blob).not.toContain("row-provenance-1");
    expect(blob).not.toContain("src_conn_1");
    expect(blob).not.toContain("import_job_1");
    expect(blob).not.toContain("abc123checksum");
    expect(blob).not.toContain("google-sheets");
  });

  it("audit metadata does not contain full source payload or promptText", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "audit-prov",
      title: "Audit Prov",
      promptText: "SecretPromptBodyXYZ",
      ownerId: "user_1",
      source: sheetsSource(),
    });
    await publishPrompt(ports, ctx, created.id, created.revision);
    const events = await ports.auditRepo.listByEntity("prompt", created.id);
    const blob = JSON.stringify(events);
    expect(blob).not.toContain("SecretPromptBodyXYZ");
    expect(blob).not.toContain("abc123checksum");
    expect(blob).not.toContain("row-provenance-1");
    expect(events.some((e) => e.metadata?.sourceType === "google-sheets")).toBe(
      true,
    );
    expect(events.some((e) => e.metadata?.hasExternalId === true)).toBe(true);
  });

  it("architecture: markPromptPublished preserves entity source", () => {
    const src = readFileSync(
      join(process.cwd(), "src/domain/content/prompt.ts"),
      "utf8",
    );
    const fn = src.slice(src.indexOf("export function markPromptPublished"));
    expect(fn).toMatch(/source:\s*prompt\.source/);
    expect(fn).not.toMatch(/portalSource\(\)/);
  });

  it("ContentVersion creation reason stays portal on publish", async () => {
    const ports = createTestPorts();
    const ctx = testCtx();
    const created = await createPromptUseCase(ports, ctx, {
      slug: "ver-source",
      title: "VS",
      promptText: "Text",
      ownerId: "user_1",
      source: sheetsSource(),
    });
    const pub = await publishPrompt(
      ports,
      ctx,
      created.id,
      created.revision,
    );
    const version = await ports.versions.getById(pub.versionId);
    expect(version?.source.type).toBe("portal");
    // sanity: factory default
    const manual = createContentVersion({
      id: "version_x",
      entityType: "prompt",
      entityId: created.id,
      versionNumber: 99,
      snapshot: toPromptSnapshot(created),
      createdAt: TEST_NOW,
      createdBy: "user_1",
    });
    expect(manual.source.type).toBe("portal");
  });
});
