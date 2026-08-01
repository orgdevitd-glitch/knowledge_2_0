import type { ContentBlock } from "@/domain/content/blocks";
import type { MediaPresentation } from "./media-resolver";
import type { MediaPresentationResolver } from "./media-resolver";

export function collectMediaIdsFromBlocks(
  blocks: readonly ContentBlock[],
): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === "image" || block.type === "file") {
      ids.add(block.data.mediaId);
    } else if (block.type === "gallery") {
      for (const item of block.data.items) ids.add(item.mediaId);
    } else if (block.type === "video") {
      if (block.data.posterMediaId) ids.add(block.data.posterMediaId);
    }
  }
  return [...ids];
}

export async function resolveMediaPresentations(
  mediaIds: readonly string[],
  resolver: MediaPresentationResolver,
): Promise<Record<string, MediaPresentation>> {
  const out: Record<string, MediaPresentation> = {};
  await Promise.all(
    mediaIds.map(async (id) => {
      out[id] = await resolver.resolve(id);
    }),
  );
  return out;
}
