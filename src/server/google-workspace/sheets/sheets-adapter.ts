import "server-only";

import { google, type sheets_v4 } from "googleapis";

import { getGoogleWorkspaceConfig } from "@/config/env";
import { getGoogleWorkspaceAuth } from "../auth/credentials";
import { GoogleWorkspaceError, mapGoogleApiError } from "../errors";
import type {
  BatchGetValuesOptions,
  GoogleSheetsPort,
  SheetValues,
  SpreadsheetMeta,
} from "../ports";
import { withGoogleRetry } from "../retry/request";

function mapSpreadsheetMeta(
  spreadsheet: sheets_v4.Schema$Spreadsheet | undefined | null,
  modifiedTime: string | null,
  version: string | null,
): SpreadsheetMeta {
  if (!spreadsheet?.spreadsheetId) {
    throw new GoogleWorkspaceError(
      "GOOGLE_SHEET_SCHEMA_INVALID",
      "Spreadsheet metadata is incomplete",
    );
  }

  return {
    id: spreadsheet.spreadsheetId,
    title: spreadsheet.properties?.title ?? "",
    sheetNames: (spreadsheet.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
    modifiedTime,
    version,
  };
}

function mapValueRange(range: sheets_v4.Schema$ValueRange): SheetValues {
  return {
    range: range.range ?? "",
    majorDimension:
      range.majorDimension === "COLUMNS" ? "COLUMNS" : "ROWS",
    values: (range.values ?? []).map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
    ),
  };
}

export class GoogleSheetsAdapter implements GoogleSheetsPort {
  private readonly sheets: sheets_v4.Sheets;
  private readonly drive: ReturnType<typeof google.drive>;
  private readonly retryOptions: {
    maxAttempts: number;
    timeoutMs: number;
  };

  constructor(sheets: sheets_v4.Sheets, drive: ReturnType<typeof google.drive>) {
    this.sheets = sheets;
    this.drive = drive;
    const config = getGoogleWorkspaceConfig();
    this.retryOptions = {
      maxAttempts: config.maxRetryAttempts,
      timeoutMs: config.requestTimeoutMs,
    };
  }

  static async create(): Promise<GoogleSheetsAdapter> {
    const auth = getGoogleWorkspaceAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });
    return new GoogleSheetsAdapter(sheets, drive);
  }

  async getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMeta> {
    try {
      const [spreadsheetResponse, driveResponse] = await Promise.all([
        withGoogleRetry(
          async () =>
            this.sheets.spreadsheets.get({
              spreadsheetId,
              fields: "spreadsheetId,properties/title,sheets/properties/title",
            }),
          this.retryOptions,
        ),
        withGoogleRetry(
          async () =>
            this.drive.files.get({
              fileId: spreadsheetId,
              supportsAllDrives: true,
              fields: "modifiedTime,version",
            }),
          this.retryOptions,
        ),
      ]);

      return mapSpreadsheetMeta(
        spreadsheetResponse.data,
        driveResponse.data.modifiedTime ?? null,
        driveResponse.data.version ?? null,
      );
    } catch (error) {
      throw mapGoogleApiError(error);
    }
  }

  async batchGetValues(
    spreadsheetId: string,
    options: BatchGetValuesOptions,
  ): Promise<SheetValues[]> {
    if (options.ranges.length === 0) {
      return [];
    }

    try {
      const response = await withGoogleRetry(
        async () =>
          this.sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: options.ranges,
            majorDimension: options.majorDimension ?? "ROWS",
          }),
        this.retryOptions,
      );

      return (response.data.valueRanges ?? []).map((range) =>
        mapValueRange(range),
      );
    } catch (error) {
      throw mapGoogleApiError(error);
    }
  }
}
