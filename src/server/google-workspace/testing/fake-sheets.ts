import "server-only";

import { GoogleWorkspaceError } from "../errors";
import type {
  BatchGetValuesOptions,
  GoogleSheetsPort,
  SheetValues,
  SpreadsheetMeta,
} from "../ports";

export type FakeSpreadsheet = SpreadsheetMeta & {
  valuesByRange: Record<string, string[][]>;
};

export class FakeGoogleSheetsAdapter implements GoogleSheetsPort {
  private readonly spreadsheets = new Map<string, FakeSpreadsheet>();

  constructor(initialSpreadsheets: FakeSpreadsheet[] = []) {
    for (const spreadsheet of initialSpreadsheets) {
      this.spreadsheets.set(spreadsheet.id, spreadsheet);
    }
  }

  seed(spreadsheet: FakeSpreadsheet): void {
    this.spreadsheets.set(spreadsheet.id, spreadsheet);
  }

  async getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMeta> {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_NOT_FOUND",
        "Fake spreadsheet not found",
        { spreadsheetId },
      );
    }
    return {
      id: spreadsheet.id,
      title: spreadsheet.title,
      sheetNames: [...spreadsheet.sheetNames],
      modifiedTime: spreadsheet.modifiedTime,
      version: spreadsheet.version,
    };
  }

  async batchGetValues(
    spreadsheetId: string,
    options: BatchGetValuesOptions,
  ): Promise<SheetValues[]> {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_NOT_FOUND",
        "Fake spreadsheet not found",
        { spreadsheetId },
      );
    }

    return options.ranges.map((range) => ({
      range,
      majorDimension: options.majorDimension ?? "ROWS",
      values: spreadsheet.valuesByRange[range] ?? [],
    }));
  }
}
