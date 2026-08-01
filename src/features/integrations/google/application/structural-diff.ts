import type { ContentBlock } from "@/domain/content/blocks";
import type { Article } from "@/domain/content/article";
import type { ArticleImportDraft } from "../docs/article-import-draft";

export type StructuralArticleDiff = {
  titleChanged: boolean;
  summaryChanged: boolean;
  blockCountBefore: number;
  blockCountAfter: number;
  addedBlockIds: string[];
  removedBlockIds: string[];
  changedBlockIds: string[];
  headingStructureBefore: string[];
  headingStructureAfter: string[];
};

function headingOutline(blocks: ContentBlock[]): string[] {
  return blocks
    .filter((b) => b.type === "heading")
    .map((b) => {
      const data = b.data as { level: number; text: string };
      return `H${data.level}:${data.text}`;
    });
}

function blockFingerprint(block: ContentBlock): string {
  return JSON.stringify({
    type: block.type,
    data: block.data,
    settings: block.settings,
  });
}

export function structuralDiffArticle(
  existing: Article,
  draft: ArticleImportDraft,
): StructuralArticleDiff {
  const beforeMap = new Map(existing.blocks.map((b) => [b.id, b]));
  const afterMap = new Map(draft.blocks.map((b) => [b.id, b]));

  const addedBlockIds: string[] = [];
  const removedBlockIds: string[] = [];
  const changedBlockIds: string[] = [];

  for (const id of afterMap.keys()) {
    if (!beforeMap.has(id)) addedBlockIds.push(id);
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) removedBlockIds.push(id);
  }
  for (const [id, before] of beforeMap) {
    const after = afterMap.get(id);
    if (!after) continue;
    if (blockFingerprint(before) !== blockFingerprint(after)) {
      changedBlockIds.push(id);
    }
  }

  return {
    titleChanged: existing.title !== draft.proposedTitle,
    summaryChanged: existing.summary !== draft.proposedSummary,
    blockCountBefore: existing.blocks.length,
    blockCountAfter: draft.blocks.length,
    addedBlockIds,
    removedBlockIds,
    changedBlockIds,
    headingStructureBefore: headingOutline(existing.blocks),
    headingStructureAfter: headingOutline(draft.blocks),
  };
}
