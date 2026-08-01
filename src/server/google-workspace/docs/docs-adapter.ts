import "server-only";

import { google, type docs_v1 } from "googleapis";

import { getGoogleWorkspaceConfig } from "@/config/env";
import { getGoogleWorkspaceAuth } from "../auth/credentials";
import { GoogleWorkspaceError, mapGoogleApiError } from "../errors";
import type { GoogleDocsPort, GoogleDocumentDto } from "../ports";
import { withGoogleRetry } from "../retry/request";

function mapDocument(
  document: docs_v1.Schema$Document | undefined | null,
): GoogleDocumentDto {
  if (!document?.documentId) {
    throw new GoogleWorkspaceError(
      "GOOGLE_DOCUMENT_INVALID",
      "Google Docs response is missing document id",
    );
  }

  const title = document.title ?? "";
  const body = (document.body ?? {}) as Record<string, unknown>;
  const lists = (document.lists ?? undefined) as
    | Record<string, unknown>
    | undefined;

  return {
    id: document.documentId,
    title,
    body,
    ...(lists ? { lists } : {}),
  };
}

export class GoogleDocsAdapter implements GoogleDocsPort {
  private readonly docs: docs_v1.Docs;
  private readonly retryOptions: {
    maxAttempts: number;
    timeoutMs: number;
  };

  constructor(docs: docs_v1.Docs) {
    this.docs = docs;
    const config = getGoogleWorkspaceConfig();
    this.retryOptions = {
      maxAttempts: config.maxRetryAttempts,
      timeoutMs: config.requestTimeoutMs,
    };
  }

  static async create(): Promise<GoogleDocsAdapter> {
    const auth = getGoogleWorkspaceAuth();
    const docs = google.docs({ version: "v1", auth });
    return new GoogleDocsAdapter(docs);
  }

  async getDocument(documentId: string): Promise<GoogleDocumentDto> {
    try {
      const response = await withGoogleRetry(
        async () =>
          this.docs.documents.get({
            documentId,
          }),
        this.retryOptions,
      );
      return mapDocument(response.data);
    } catch (error) {
      throw mapGoogleApiError(error);
    }
  }
}
