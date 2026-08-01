import "server-only";

import type { GoogleWorkspaceConfig } from "@/config/env";
import { GoogleWorkspaceError } from "../errors";
import { GOOGLE_WORKSPACE_LIMITS } from "../limits";
import {
  GOOGLE_DRIVE_MIME_TYPES,
  type DriveFileMetadata,
  type GoogleDrivePort,
} from "../ports";

export type BoundaryCheckResult =
  | { allowed: true; metadata: DriveFileMetadata }
  | { allowed: false; code: GoogleWorkspaceError["code"]; message: string };

const SUPPORTED_IMPORT_MIME_TYPES = new Set<string>([
  GOOGLE_DRIVE_MIME_TYPES.document,
  GOOGLE_DRIVE_MIME_TYPES.spreadsheet,
  GOOGLE_DRIVE_MIME_TYPES.folder,
]);

export class GoogleDriveBoundaryPolicy {
  private readonly cache = new Map<string, DriveFileMetadata>();

  constructor(
    private readonly drive: GoogleDrivePort,
    private readonly config: Pick<
      GoogleWorkspaceConfig,
      "sharedDriveId" | "rootFolderId" | "allowedFolderIds"
    >,
  ) {}

  private getAllowedRoots(): string[] {
    const roots = [this.config.rootFolderId, ...this.config.allowedFolderIds];
    return [...new Set(roots)];
  }

  private async getCachedMetadata(fileId: string): Promise<DriveFileMetadata> {
    const cached = this.cache.get(fileId);
    if (cached) return cached;
    const metadata = await this.drive.getFileMetadata(fileId);
    this.cache.set(fileId, metadata);
    return metadata;
  }

  assertSharedDrive(metadata: DriveFileMetadata): void {
    if (metadata.driveId !== this.config.sharedDriveId) {
      throw new GoogleWorkspaceError(
        "GOOGLE_SHARED_DRIVE_MISMATCH",
        "File is not in the configured Shared Drive",
        { fileId: metadata.id },
      );
    }
  }

  assertNotTrashed(metadata: DriveFileMetadata): void {
    if (metadata.trashed) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_NOT_FOUND",
        "File is trashed or unavailable",
        { fileId: metadata.id },
      );
    }
  }

  assertSupportedMimeType(
    metadata: DriveFileMetadata,
    allowed: Set<string> = SUPPORTED_IMPORT_MIME_TYPES,
  ): void {
    if (!allowed.has(metadata.mimeType)) {
      throw new GoogleWorkspaceError(
        "GOOGLE_UNSUPPORTED_FILE_TYPE",
        "Unsupported Google file type",
        { fileId: metadata.id, mimeType: metadata.mimeType },
      );
    }
  }

  async isWithinAllowedBoundary(fileId: string): Promise<boolean> {
    try {
      await this.verifyWithinAllowedBoundary(fileId);
      return true;
    } catch {
      return false;
    }
  }

  async verifyWithinAllowedBoundary(fileId: string): Promise<DriveFileMetadata> {
    const metadata = await this.getCachedMetadata(fileId);
    this.assertNotTrashed(metadata);
    this.assertSharedDrive(metadata);

    const allowedRoots = this.getAllowedRoots();
    if (allowedRoots.includes(fileId)) {
      return metadata;
    }

    const parents = metadata.parents;
    if (parents.length === 0) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
        "File is outside the allowed root folder",
        { fileId },
      );
    }

    const visited = new Set<string>([fileId]);
    let currentIds = [...parents];
    let depth = 0;

    while (currentIds.length > 0) {
      depth += 1;
      if (depth > GOOGLE_WORKSPACE_LIMITS.BOUNDARY_MAX_DEPTH) {
        throw new GoogleWorkspaceError(
          "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
          "Folder hierarchy exceeds allowed depth",
          { fileId, depth },
        );
      }

      const nextLevel: string[] = [];

      for (const parentId of currentIds) {
        if (allowedRoots.includes(parentId)) {
          return metadata;
        }

        if (visited.has(parentId)) {
          throw new GoogleWorkspaceError(
            "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
            "Folder hierarchy cycle detected",
            { fileId, parentId },
          );
        }
        visited.add(parentId);

        const parent = await this.getCachedMetadata(parentId);
        this.assertNotTrashed(parent);
        this.assertSharedDrive(parent);

        if (parent.parents.length === 0) {
          continue;
        }
        nextLevel.push(...parent.parents);
      }

      currentIds = nextLevel;
    }

    throw new GoogleWorkspaceError(
      "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
      "File is outside the allowed root folder",
      { fileId },
    );
  }

  async verifyFileForImport(fileId: string): Promise<DriveFileMetadata> {
    const metadata = await this.verifyWithinAllowedBoundary(fileId);
    this.assertSupportedMimeType(metadata, new Set([
      GOOGLE_DRIVE_MIME_TYPES.document,
      GOOGLE_DRIVE_MIME_TYPES.spreadsheet,
    ]));
    return metadata;
  }

  async verifyFolderForBrowse(folderId: string): Promise<DriveFileMetadata> {
    const metadata = await this.verifyWithinAllowedBoundary(folderId);
    if (metadata.mimeType !== GOOGLE_DRIVE_MIME_TYPES.folder) {
      throw new GoogleWorkspaceError(
        "GOOGLE_UNSUPPORTED_FILE_TYPE",
        "Expected a Google Drive folder",
        { fileId: folderId, mimeType: metadata.mimeType },
      );
    }
    return metadata;
  }
}
