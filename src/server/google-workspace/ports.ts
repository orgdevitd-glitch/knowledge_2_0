import "server-only";

export const GOOGLE_DRIVE_MIME_TYPES = {
  folder: "application/vnd.google-apps.folder",
  document: "application/vnd.google-apps.document",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
} as const;

export type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  createdTime: string | null;
  parents: string[];
  driveId: string | null;
  trashed: boolean;
  size: number | null;
  version: string | null;
  webViewLink: string | null;
  canDownload: boolean;
};

export type DriveFolderChild = DriveFileMetadata;

export type DriveListPage = {
  items: DriveFolderChild[];
  nextPageToken: string | null;
};

export type GoogleDocumentDto = {
  id: string;
  title: string;
  /** Raw Docs API body for downstream mappers; not persisted as-is. */
  body: Record<string, unknown>;
  /** Docs lists dictionary (glyph types); not persisted as-is. */
  lists?: Record<string, unknown>;
};
export type SpreadsheetMeta = {
  id: string;
  title: string;
  sheetNames: string[];
  modifiedTime: string | null;
  version: string | null;
};

export type SheetValues = {
  range: string;
  majorDimension: "ROWS" | "COLUMNS";
  values: string[][];
};

export type DriveListOptions = {
  pageToken?: string;
  pageSize?: number;
  query?: string;
};

export type BatchGetValuesOptions = {
  ranges: string[];
  majorDimension?: "ROWS" | "COLUMNS";
};

export interface GoogleDrivePort {
  getFileMetadata(fileId: string): Promise<DriveFileMetadata>;
  listFolderChildren(
    folderId: string,
    options?: DriveListOptions,
  ): Promise<DriveListPage>;
  verifyFileAccess(fileId: string): Promise<DriveFileMetadata>;
  verifyFolderAccess(folderId: string): Promise<DriveFileMetadata>;
}

export interface GoogleDocsPort {
  getDocument(documentId: string): Promise<GoogleDocumentDto>;
}

export interface GoogleSheetsPort {
  getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMeta>;
  batchGetValues(
    spreadsheetId: string,
    options: BatchGetValuesOptions,
  ): Promise<SheetValues[]>;
}

export type GoogleWorkspaceClients = {
  drive: GoogleDrivePort;
  docs: GoogleDocsPort;
  sheets: GoogleSheetsPort;
};
