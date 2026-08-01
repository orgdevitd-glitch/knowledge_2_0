import { randomBytes } from "node:crypto";

import { assertSafeStorageKeySegment } from "@/domain/content/media-sniff";

/** Server-only random storage key. Never derived from user filename. */
export function generateMediaStorageKey(mediaId: string): string {
  assertSafeStorageKeySegment(mediaId);
  const objectId = randomBytes(16).toString("hex");
  assertSafeStorageKeySegment(objectId);
  return `media/${mediaId}/${objectId}`;
}
