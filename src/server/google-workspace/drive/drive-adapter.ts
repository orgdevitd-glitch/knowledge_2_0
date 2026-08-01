import "server-only";

import { google, type drive_v3 } from "googleapis";

import { getGoogleWorkspaceConfig } from "@/config/env";
import { getGoogleWorkspaceAuth } from "../auth/credentials";
import { GoogleWorkspaceError, mapGoogleApiError } from "../errors";
import { GOOGLE_WORKSPACE_LIMITS } from "../limits";
import type {
  DriveFileMetadata,
  DriveListOptions,
  DriveListPage,
  GoogleDrivePort,
} from "../ports";
import { withGoogleRetry } from "../retry/request";

const DRIVE_FILE_FIELDS =
  "id,name,mimeType,modifiedTime,createdTime,parents,driveId,trashed,size,version,webViewLink,capabilities/canDownload";

function mapDriveFile(
  file: drive_v3.Schema$File | undefined | null,
): DriveFileMetadata {
  if (!file?.id || !file.name || !file.mimeType) {
    throw new GoogleWorkspaceError(
      "GOOGLE_FILE_NOT_FOUND",
      "Drive file metadata is incomplete",
    );
  }
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime ?? null,
    createdTime: file.createdTime ?? null,
    parents: file.parents ?? [],
    driveId: file.driveId ?? null,
    trashed: file.trashed ?? false,
    size: file.size ? Number(file.size) : null,
    version: file.version ?? null,
    webViewLink: file.webViewLink ?? null,
    canDownload: file.capabilities?.canDownload ?? false,
  };
}

export class GoogleDriveAdapter implements GoogleDrivePort {
  private readonly drive: drive_v3.Drive;
  private readonly sharedDriveId: string;
  private readonly retryOptions: {
    maxAttempts: number;
    timeoutMs: number;
  };

  constructor(drive: drive_v3.Drive, sharedDriveId: string) {
    this.drive = drive;
    this.sharedDriveId = sharedDriveId;
    const config = getGoogleWorkspaceConfig();
    this.retryOptions = {
      maxAttempts: config.maxRetryAttempts,
      timeoutMs: config.requestTimeoutMs,
    };
  }

  static async create(): Promise<GoogleDriveAdapter> {
    const config = getGoogleWorkspaceConfig();
    const auth = getGoogleWorkspaceAuth();
    const drive = google.drive({ version: "v3", auth });
    return new GoogleDriveAdapter(drive, config.sharedDriveId);
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await withGoogleRetry(async () => operation(), this.retryOptions);
    } catch (error) {
      throw mapGoogleApiError(error);
    }
  }

  async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    const response = await this.execute(() =>
      this.drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: DRIVE_FILE_FIELDS,
      }),
    );
    return mapDriveFile(response.data);
  }

  async listFolderChildren(
    folderId: string,
    options: DriveListOptions = {},
  ): Promise<DriveListPage> {
    const pageSize = Math.min(
      options.pageSize ?? GOOGLE_WORKSPACE_LIMITS.MAX_DRIVE_PAGE_SIZE,
      GOOGLE_WORKSPACE_LIMITS.MAX_DRIVE_PAGE_SIZE,
    );

    const qParts = [`'${folderId}' in parents`, "trashed = false"];
    if (options.query?.trim()) {
      const escaped = options.query.trim().replace(/'/g, "\\'");
      qParts.push(`name contains '${escaped}'`);
    }

    const response = await this.execute(() =>
      this.drive.files.list({
        corpora: "drive",
        driveId: this.sharedDriveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        q: qParts.join(" and "),
        pageSize,
        pageToken: options.pageToken,
        fields: `nextPageToken,files(${DRIVE_FILE_FIELDS})`,
        orderBy: "folder,name",
      }),
    );

    return {
      items: (response.data.files ?? []).map((file) => mapDriveFile(file)),
      nextPageToken: response.data.nextPageToken ?? null,
    };
  }

  async verifyFileAccess(fileId: string): Promise<DriveFileMetadata> {
    try {
      return await this.getFileMetadata(fileId);
    } catch (error) {
      if (error instanceof GoogleWorkspaceError) {
        throw error;
      }
      throw mapGoogleApiError(error);
    }
  }

  async verifyFolderAccess(folderId: string): Promise<DriveFileMetadata> {
    const metadata = await this.verifyFileAccess(folderId);
    if (metadata.mimeType !== "application/vnd.google-apps.folder") {
      throw new GoogleWorkspaceError(
        "GOOGLE_UNSUPPORTED_FILE_TYPE",
        "Expected a Google Drive folder",
        { fileId: folderId, mimeType: metadata.mimeType },
      );
    }
    return metadata;
  }
}
