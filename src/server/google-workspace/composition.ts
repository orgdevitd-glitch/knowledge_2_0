import "server-only";

import { getGoogleWorkspaceMode } from "@/config/env";
import { GoogleWorkspaceError } from "./errors";
import { GoogleDocsAdapter } from "./docs/docs-adapter";
import { GoogleDriveAdapter } from "./drive/drive-adapter";
import { GoogleSheetsAdapter } from "./sheets/sheets-adapter";
import type { GoogleWorkspaceClients } from "./ports";

let cachedClients: GoogleWorkspaceClients | null = null;

export function isGoogleWorkspaceEnabled(): boolean {
  return getGoogleWorkspaceMode() === "service-account";
}

export async function getGoogleWorkspaceClients(): Promise<GoogleWorkspaceClients> {
  if (!isGoogleWorkspaceEnabled()) {
    throw new GoogleWorkspaceError(
      "GOOGLE_WORKSPACE_DISABLED",
      "Google Workspace integration is disabled",
    );
  }

  if (cachedClients) {
    return cachedClients;
  }

  const [drive, docs, sheets] = await Promise.all([
    GoogleDriveAdapter.create(),
    GoogleDocsAdapter.create(),
    GoogleSheetsAdapter.create(),
  ]);

  cachedClients = { drive, docs, sheets };
  return cachedClients;
}

export function resetGoogleWorkspaceClientsForTests(): void {
  cachedClients = null;
}
