/**
 * Resolves MediaAsset presentation for public renderers.
 * Only ready assets are deliverable via same-origin /media/{id}.
 */
export type MediaPresentation =
  | { status: "unavailable"; reason: "not-configured" | "not-ready" | "not-found" }
  | {
      status: "ready";
      url: string;
      mimeType: string;
      kind: string;
      title: string;
      defaultAltText: string | null;
    };

export interface MediaPresentationResolver {
  resolve(mediaId: string): Promise<MediaPresentation>;
}

export class UnavailableMediaPresentationResolver
  implements MediaPresentationResolver
{
  async resolve(): Promise<MediaPresentation> {
    return { status: "unavailable", reason: "not-configured" };
  }
}

export class RepositoryMediaPresentationResolver
  implements MediaPresentationResolver
{
  constructor(
    private readonly getMedia: (id: string) => Promise<{
      status: string;
      mimeType: string | null;
      kind: string;
      title: string;
      defaultAltText: string | null;
    } | null>,
  ) {}

  async resolve(mediaId: string): Promise<MediaPresentation> {
    const media = await this.getMedia(mediaId);
    if (!media) {
      return { status: "unavailable", reason: "not-found" };
    }
    if (media.status !== "ready" || !media.mimeType) {
      return { status: "unavailable", reason: "not-ready" };
    }
    return {
      status: "ready",
      url: `/media/${mediaId}`,
      mimeType: media.mimeType,
      kind: media.kind,
      title: media.title,
      defaultAltText: media.defaultAltText,
    };
  }
}

export const defaultMediaResolver = new UnavailableMediaPresentationResolver();
