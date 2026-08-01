import "server-only";

import { GoogleWorkspaceError } from "../errors";
import { GOOGLE_WORKSPACE_LIMITS } from "../limits";
import {
  GOOGLE_DRIVE_MIME_TYPES,
  type DriveFileMetadata,
  type DriveListOptions,
  type DriveListPage,
  type GoogleDrivePort,
} from "../ports";

export type FakeDriveNode = DriveFileMetadata & {
  children?: string[];
};

export class FakeGoogleDriveAdapter implements GoogleDrivePort {
  private readonly files = new Map<string, FakeDriveNode>();

  constructor(initialFiles: FakeDriveNode[] = []) {
    for (const file of initialFiles) {
      this.files.set(file.id, { ...file, children: file.children ?? [] });
    }
  }

  seed(file: FakeDriveNode): void {
    this.files.set(file.id, { ...file, children: file.children ?? [] });
  }

  async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    const file = this.files.get(fileId);
    if (!file) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_NOT_FOUND",
        "Fake Drive file not found",
        { fileId },
      );
    }
    return this.toMetadata(file);
  }

  async listFolderChildren(
    folderId: string,
    options: DriveListOptions = {},
  ): Promise<DriveListPage> {
    const folder = this.files.get(folderId);
    if (!folder) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_NOT_FOUND",
        "Fake Drive folder not found",
        { folderId },
      );
    }

    const childIds = folder.children ?? [];
    let items = (
      await Promise.all(
        childIds.map(async (childId) => this.getFileMetadata(childId)),
      )
    ).filter((item) => !item.trashed);

    const query = options.query?.trim().toLowerCase();
    if (query) {
      items = items.filter((item) => item.name.toLowerCase().includes(query));
    }

    const pageSize = Math.min(
      options.pageSize ?? GOOGLE_WORKSPACE_LIMITS.MAX_DRIVE_PAGE_SIZE,
      GOOGLE_WORKSPACE_LIMITS.MAX_DRIVE_PAGE_SIZE,
    );
    const startIndex = options.pageToken
      ? Number.parseInt(options.pageToken, 10)
      : 0;
    const pageItems = items.slice(startIndex, startIndex + pageSize);
    const nextIndex = startIndex + pageItems.length;
    const nextPageToken =
      nextIndex < items.length ? String(nextIndex) : null;

    return { items: pageItems, nextPageToken };
  }

  async verifyFileAccess(fileId: string): Promise<DriveFileMetadata> {
    return this.getFileMetadata(fileId);
  }

  async verifyFolderAccess(folderId: string): Promise<DriveFileMetadata> {
    const metadata = await this.getFileMetadata(folderId);
    if (metadata.mimeType !== GOOGLE_DRIVE_MIME_TYPES.folder) {
      throw new GoogleWorkspaceError(
        "GOOGLE_UNSUPPORTED_FILE_TYPE",
        "Expected a Google Drive folder",
        { fileId: folderId },
      );
    }
    return metadata;
  }

  private toMetadata(file: FakeDriveNode): DriveFileMetadata {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      createdTime: file.createdTime,
      parents: [...file.parents],
      driveId: file.driveId,
      trashed: file.trashed,
      size: file.size,
      version: file.version,
      webViewLink: file.webViewLink,
      canDownload: file.canDownload,
    };
  }
}

export function createFakeDriveTree(options: {
  sharedDriveId: string;
  rootFolderId: string;
}): FakeGoogleDriveAdapter {
  const { sharedDriveId, rootFolderId } = options;
  const root: FakeDriveNode = {
    id: rootFolderId,
    name: "Root",
    mimeType: GOOGLE_DRIVE_MIME_TYPES.folder,
    modifiedTime: "2026-01-01T00:00:00.000Z",
    createdTime: "2026-01-01T00:00:00.000Z",
    parents: [],
    driveId: sharedDriveId,
    trashed: false,
    size: null,
    version: "1",
    webViewLink: null,
    canDownload: false,
    children: [],
  };
  return new FakeGoogleDriveAdapter([root]);
}
