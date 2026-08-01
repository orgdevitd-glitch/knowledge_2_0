import "server-only";

import { google } from "googleapis";

import { getGoogleWorkspaceConfig, getGoogleWorkspaceMode } from "@/config/env";
import { GoogleWorkspaceError } from "../errors";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
] as const;

type GoogleAuthClient = InstanceType<typeof google.auth.GoogleAuth>;

let cachedAuth: GoogleAuthClient | null = null;

function createGoogleAuth(): GoogleAuthClient {
  const mode = getGoogleWorkspaceMode();
  if (mode !== "service-account") {
    throw new GoogleWorkspaceError(
      "GOOGLE_WORKSPACE_DISABLED",
      "Google Workspace integration is disabled",
    );
  }

  const config = getGoogleWorkspaceConfig();
  const options: ConstructorParameters<typeof google.auth.GoogleAuth>[0] = {
    scopes: [...GOOGLE_WORKSPACE_SCOPES],
  };
  if (config.projectId) {
    options.projectId = config.projectId;
  }

  try {
    return new google.auth.GoogleAuth(options);
  } catch (error) {
    throw new GoogleWorkspaceError(
      "GOOGLE_AUTHENTICATION_FAILED",
      "Failed to initialize Google Workspace credentials",
      {},
      { cause: error },
    );
  }
}

export function getGoogleWorkspaceAuth(): GoogleAuthClient {
  if (!cachedAuth) {
    cachedAuth = createGoogleAuth();
  }
  return cachedAuth;
}

/** Returns an authorized client for the given API version. */
export async function getGoogleAuthorizedClient<T>(
  apiVersion: string,
): Promise<T> {
  try {
    const auth = getGoogleWorkspaceAuth();
    return (await auth.getClient()) as T;
  } catch (error) {
    if (error instanceof GoogleWorkspaceError) {
      throw error;
    }
    throw new GoogleWorkspaceError(
      "GOOGLE_AUTHENTICATION_FAILED",
      "Failed to obtain Google Workspace authorized client",
      { apiVersion },
      { cause: error },
    );
  }
}

export function resetGoogleWorkspaceAuthForTests(): void {
  cachedAuth = null;
}

/** Test-only helper to inject credentials without env files. */
export function setGoogleWorkspaceAuthForTests(
  credentials: NonNullable<
    ConstructorParameters<typeof google.auth.GoogleAuth>[0]
  >["credentials"],
): void {
  cachedAuth = new google.auth.GoogleAuth({
    credentials,
    scopes: [...GOOGLE_WORKSPACE_SCOPES],
  });
}
