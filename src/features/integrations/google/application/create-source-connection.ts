import "server-only";

import type { SourceConnection } from "@/domain/integrations/source-connection";
import { parseSourceConnection } from "@/domain/integrations/source-connection";
import { createAuditEvent } from "@/domain/content/audit";
import { UserId } from "@/domain/shared/ids";
import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import {
  GOOGLE_DRIVE_MIME_TYPES,
  type DriveFileMetadata,
} from "@/server/google-workspace/ports";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import { parseGoogleWorkspaceUrl } from "@/server/google-workspace/url-parser";

import type { IntegrationPorts } from "./ports";

function sourceTypeFromMime(
  mimeType: string,
): SourceConnection["sourceType"] {
  if (mimeType === GOOGLE_DRIVE_MIME_TYPES.document) return "google-docs";
  if (mimeType === GOOGLE_DRIVE_MIME_TYPES.spreadsheet) return "google-sheets";
  if (mimeType === GOOGLE_DRIVE_MIME_TYPES.folder) return "google-drive-folder";
  throw new GoogleWorkspaceError(
    "GOOGLE_UNSUPPORTED_FILE_TYPE",
    "Unsupported Google file type for source connection",
  );
}

export async function createSourceConnection(
  ports: IntegrationPorts,
  input: {
    actorId: string;
    requestId: string;
    urlOrId: string;
    targetEntityType: SourceConnection["targetEntityType"];
    targetEntityId?: string | null;
  },
): Promise<SourceConnection> {
  const parsed = parseGoogleWorkspaceUrl(input.urlOrId);
  const policy = new GoogleDriveBoundaryPolicy(ports.google.drive, ports.config);
  let metadata: DriveFileMetadata;
  try {
    metadata = await policy.verifyFileForImport(parsed.externalId);
  } catch (error) {
    if (error instanceof GoogleWorkspaceError) throw error;
    throw new GoogleWorkspaceError(
      "GOOGLE_ACCESS_DENIED",
      "Unable to verify Google file access",
    );
  }

  const existing = await ports.sources.getByExternalId(metadata.id);
  if (existing && existing.status !== "archived") {
    return existing;
  }

  const now = ports.content.clock.now();
  const connection = parseSourceConnection({
    id: ports.content.ids.next("src"),
    provider: "google-workspace",
    sourceType: sourceTypeFromMime(metadata.mimeType),
    externalId: metadata.id,
    sharedDriveId: ports.config.sharedDriveId,
    rootFolderId: ports.config.rootFolderId,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId ?? null,
    displayName: metadata.name,
    mimeType: metadata.mimeType,
    status: "active",
    lastKnownModifiedAt: metadata.modifiedTime,
    lastKnownVersion: metadata.version,
    lastImportedChecksum: null,
    lastImportedAt: null,
    createdBy: UserId.parse(input.actorId),
    createdAt: now,
    updatedAt: now,
    revision: 0,
  });

  const saved = await ports.sources.save(connection, 0);
  await ports.content.audit.append(
    createAuditEvent({
      id: ports.content.ids.next("audit"),
      eventType: "integration.source.created",
      entityType: "source-connection",
      entityId: saved.id,
      actorId: input.actorId,
      occurredAt: now,
      metadata: {
        requestId: input.requestId,
        sourceType: saved.sourceType,
        targetEntityType: saved.targetEntityType,
      },
    }),
  );
  return saved;
}
