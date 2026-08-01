import { createHash } from "node:crypto";

import type { ArticleImportDraft } from "./article-import-draft";

/** Deterministic checksum of normalized Docs import content (not raw API). */
export function checksumArticleImportDraft(
  draft: Pick<
    ArticleImportDraft,
    "proposedTitle" | "proposedSlug" | "proposedSummary" | "blocks"
  >,
): string {
  const payload = JSON.stringify({
    proposedTitle: draft.proposedTitle,
    proposedSlug: draft.proposedSlug,
    proposedSummary: draft.proposedSummary,
    blocks: draft.blocks,
  });
  return createHash("sha256").update(payload).digest("hex");
}
