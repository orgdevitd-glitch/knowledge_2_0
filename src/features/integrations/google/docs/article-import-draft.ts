import type { ContentBlock } from "@/domain/content/blocks";
import type { SourceReference } from "@/domain/content/source";
import type { ImportError, ImportWarning } from "@/domain/integrations/import-job";

export type UnsupportedDocElement = {
  kind: string;
  position: number;
  detail?: string;
};

export type ArticleImportDraft = {
  proposedTitle: string;
  proposedSlug: string;
  proposedSummary: string;
  blocks: ContentBlock[];
  sourceReference: SourceReference;
  warnings: ImportWarning[];
  errors: ImportError[];
  unsupportedElements: UnsupportedDocElement[];
  documentMetadata: {
    documentId: string;
    documentTitle: string;
    tabCount: number;
    structuralElementCount: number;
    titleCandidates: string[];
  };
};
