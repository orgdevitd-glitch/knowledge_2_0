import type { Article } from "@/domain/content/article";
import type { ContentBlock } from "@/domain/content/blocks";
import { ValidationError } from "@/domain/shared/errors";
import type { ContentPorts } from "./ports";

async function assertReadyMedia(
  ports: ContentPorts,
  mediaId: string,
  path: string,
  expectedKind: "image" | "document",
): Promise<void> {
  if (!ports.media) {
    throw new ValidationError("Media library is unavailable", {
      adminCode: "PUBLISH_VALIDATION_FAILED",
      fields: { [path]: "media library unavailable" },
    });
  }
  const media = await ports.media.getById(mediaId);
  if (!media) {
    throw new ValidationError("Referenced media does not exist", {
      adminCode: "PUBLISH_VALIDATION_FAILED",
      fields: { [path]: "media not found" },
    });
  }
  if (media.status !== "ready") {
    throw new ValidationError("Referenced media is not ready", {
      adminCode: "PUBLISH_VALIDATION_FAILED",
      fields: { [path]: `media status is ${media.status}` },
    });
  }
  if (media.kind !== expectedKind) {
    throw new ValidationError("Referenced media has incompatible kind", {
      adminCode: "PUBLISH_VALIDATION_FAILED",
      fields: {
        [path]: `expected ${expectedKind}, got ${media.kind}`,
      },
    });
  }
}

async function validateBlocks(
  ports: ContentPorts,
  blocks: readonly ContentBlock[],
): Promise<void> {
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    if (block.type === "image") {
      await assertReadyMedia(
        ports,
        block.data.mediaId,
        `blocks[${i}].mediaId`,
        "image",
      );
    } else if (block.type === "file") {
      await assertReadyMedia(
        ports,
        block.data.mediaId,
        `blocks[${i}].mediaId`,
        "document",
      );
    } else if (block.type === "gallery") {
      for (let j = 0; j < block.data.items.length; j += 1) {
        await assertReadyMedia(
          ports,
          block.data.items[j]!.mediaId,
          `blocks[${i}].items[${j}].mediaId`,
          "image",
        );
      }
    } else if (block.type === "video") {
      if (block.data.mediaId) {
        throw new ValidationError(
          "Video file media is not supported in Phase 7B; use videoId or remove mediaId",
          {
            adminCode: "PUBLISH_VALIDATION_FAILED",
            fields: {
              [`blocks[${i}].mediaId`]: "video binary media not supported",
            },
          },
        );
      }
      if (block.data.posterMediaId) {
        await assertReadyMedia(
          ports,
          block.data.posterMediaId,
          `blocks[${i}].posterMediaId`,
          "image",
        );
      }
    }
  }
}

/**
 * Server-side media reference validation for Article publish.
 * Draft saves are not blocked by temporarily non-ready media.
 */
export async function assertArticleMediaReadyForPublish(
  ports: ContentPorts,
  article: Article,
): Promise<void> {
  if (article.coverMediaId) {
    await assertReadyMedia(
      ports,
      article.coverMediaId,
      "coverMediaId",
      "image",
    );
  }
  await validateBlocks(ports, article.blocks);
}
