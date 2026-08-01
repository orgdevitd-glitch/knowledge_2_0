import type { Article } from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import type { ContentVersion } from "@/domain/content/versioning";
import type { Video } from "@/domain/content/video";
import { getMediaLimits } from "@/config/media-env";
import type { ContentPorts } from "./ports";

export type MediaUsageReference = {
  entityType: "article" | "video" | "article-version";
  entityId: string;
  path: string;
  scope: "working" | "published";
};

export type MediaUsageResult = {
  mediaId: string;
  references: MediaUsageReference[];
  totalReferences: number;
  scanLimitExceeded: boolean;
  scannedArticles: number;
  scannedVersions: number;
  scannedVideos: number;
};

function collectFromBlocks(
  blocks: readonly ContentBlock[],
  mediaId: string,
  base: Omit<MediaUsageReference, "path">,
): MediaUsageReference[] {
  const refs: MediaUsageReference[] = [];
  blocks.forEach((block, index) => {
    if (block.type === "image" && block.data.mediaId === mediaId) {
      refs.push({ ...base, path: `blocks[${index}].mediaId` });
    }
    if (block.type === "file" && block.data.mediaId === mediaId) {
      refs.push({ ...base, path: `blocks[${index}].mediaId` });
    }
    if (block.type === "video") {
      if (block.data.mediaId === mediaId) {
        refs.push({ ...base, path: `blocks[${index}].mediaId` });
      }
      if (block.data.posterMediaId === mediaId) {
        refs.push({ ...base, path: `blocks[${index}].posterMediaId` });
      }
    }
    if (block.type === "gallery") {
      block.data.items.forEach((item, itemIndex) => {
        if (item.mediaId === mediaId) {
          refs.push({
            ...base,
            path: `blocks[${index}].items[${itemIndex}].mediaId`,
          });
        }
      });
    }
  });
  return refs;
}

function collectFromArticle(
  article: Article,
  mediaId: string,
  scope: "working" | "published",
): MediaUsageReference[] {
  const refs: MediaUsageReference[] = [];
  const base = {
    entityType: "article" as const,
    entityId: article.id as string,
    scope,
  };
  if (article.coverMediaId === mediaId) {
    refs.push({ ...base, path: "coverMediaId" });
  }
  refs.push(...collectFromBlocks(article.blocks, mediaId, base));
  return refs;
}

function collectFromVersionSnapshot(
  version: ContentVersion,
  mediaId: string,
): MediaUsageReference[] {
  if (version.entityType !== "article") return [];
  const snap = version.snapshot as {
    coverMediaId?: string | null;
    blocks?: ContentBlock[];
  };
  const refs: MediaUsageReference[] = [];
  const base = {
    entityType: "article-version" as const,
    entityId: version.id as string,
    scope: "published" as const,
  };
  if (snap.coverMediaId === mediaId) {
    refs.push({ ...base, path: "coverMediaId" });
  }
  if (Array.isArray(snap.blocks)) {
    refs.push(...collectFromBlocks(snap.blocks, mediaId, base));
  }
  return refs;
}

function collectFromVideo(video: Video, mediaId: string): MediaUsageReference[] {
  const refs: MediaUsageReference[] = [];
  const base = {
    entityType: "video" as const,
    entityId: video.id as string,
    scope: "working" as const,
  };
  if (video.mediaId === mediaId) {
    refs.push({ ...base, path: "mediaId" });
  }
  if (video.posterMediaId === mediaId) {
    refs.push({ ...base, path: "posterMediaId" });
  }
  if (
    video.transcript &&
    video.transcript.kind === "media" &&
    video.transcript.mediaId === mediaId
  ) {
    refs.push({ ...base, path: "transcript.mediaId" });
  }
  return refs;
}

/**
 * Bounded usage scan. Incomplete scan must never be treated as "unused".
 */
export async function analyzeMediaUsage(
  ports: ContentPorts,
  mediaId: string,
): Promise<MediaUsageResult> {
  const limits = getMediaLimits();
  const scanLimit = limits.maxUsageScan;
  const references: MediaUsageReference[] = [];
  let scanned = 0;
  let scannedArticles = 0;
  let scannedVersions = 0;
  let scannedVideos = 0;
  let scanLimitExceeded = false;

  let cursor: string | null = null;
  do {
    const page = await ports.articles.list({}, { limit: 50, cursor });
    for (const article of page.items) {
      scannedArticles += 1;
      scanned += 1;
      if (scanned > scanLimit) {
        scanLimitExceeded = true;
        break;
      }
      references.push(...collectFromArticle(article, mediaId, "working"));

      if (article.publishedVersion) {
        const version = await ports.versions.getById(article.publishedVersion);
        if (version) {
          scannedVersions += 1;
          scanned += 1;
          if (scanned > scanLimit) {
            scanLimitExceeded = true;
            break;
          }
          references.push(...collectFromVersionSnapshot(version, mediaId));
        }
      }
    }
    if (scanLimitExceeded) break;
    cursor = page.nextCursor;
  } while (cursor);

  if (!scanLimitExceeded) {
    cursor = null;
    do {
      const page = await ports.videos.list({}, { limit: 50, cursor });
      for (const video of page.items) {
        scannedVideos += 1;
        scanned += 1;
        if (scanned > scanLimit) {
          scanLimitExceeded = true;
          break;
        }
        references.push(...collectFromVideo(video, mediaId));
      }
      if (scanLimitExceeded) break;
      cursor = page.nextCursor;
    } while (cursor);
  }

  return {
    mediaId,
    references,
    totalReferences: references.length,
    scanLimitExceeded,
    scannedArticles,
    scannedVersions,
    scannedVideos,
  };
}
