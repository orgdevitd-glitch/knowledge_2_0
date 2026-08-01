import "server-only";

import { GoogleWorkspaceError } from "../errors";
import type { GoogleDocsPort, GoogleDocumentDto } from "../ports";

export class FakeGoogleDocsAdapter implements GoogleDocsPort {
  private readonly documents = new Map<string, GoogleDocumentDto>();

  constructor(initialDocuments: GoogleDocumentDto[] = []) {
    for (const document of initialDocuments) {
      this.documents.set(document.id, document);
    }
  }

  seed(document: GoogleDocumentDto): void {
    this.documents.set(document.id, document);
  }

  async getDocument(documentId: string): Promise<GoogleDocumentDto> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new GoogleWorkspaceError(
        "GOOGLE_FILE_NOT_FOUND",
        "Fake Google Doc not found",
        { documentId },
      );
    }
    return document;
  }
}
