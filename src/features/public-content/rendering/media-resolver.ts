/**
 * Future Cloud Storage will resolve media URLs.
 * Phase 4 always returns unavailable — no broken img/iframe.
 */
export type MediaPresentation =
  | { status: "unavailable"; reason: "not-configured" }
  | { status: "ready"; url: string; mimeType?: string };

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

export const defaultMediaResolver = new UnavailableMediaPresentationResolver();
