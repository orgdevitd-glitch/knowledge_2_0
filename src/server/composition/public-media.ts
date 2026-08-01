import "server-only";

import {
  defaultMediaResolver,
  RepositoryMediaPresentationResolver,
  type MediaPresentationResolver,
} from "@/features/public-content/rendering/media-resolver";
import { isContentPersistenceAvailable } from "@/server/composition/content-ports";
import { getMediaRepository } from "@/server/composition/media-ports";

export function getPublicMediaPresentationResolver(): MediaPresentationResolver {
  if (!isContentPersistenceAvailable()) {
    return defaultMediaResolver;
  }
  try {
    const repo = getMediaRepository();
    return new RepositoryMediaPresentationResolver(async (id) => {
      const media = await repo.getById(id);
      if (!media) return null;
      return {
        status: media.status,
        mimeType: media.mimeType,
        kind: media.kind,
        title: media.title as string,
        defaultAltText: media.defaultAltText,
      };
    });
  } catch {
    return defaultMediaResolver;
  }
}
