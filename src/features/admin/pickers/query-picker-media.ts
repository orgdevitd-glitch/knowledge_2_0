import "server-only";

import type { MediaAsset, MediaKind } from "@/domain/content/media";
import { isPubliclyDeliverable } from "@/domain/content/media";
import type { ContentPorts } from "@/features/content/application/ports";
import { isUnsetReferenceId } from "./placeholder-id";
import {
  PICKER_RESULT_LIMIT,
  clampPickerQuery,
} from "./picker-limits";
import type { PickerMediaItem } from "./picker-types";
import { safeMediaPreviewPath } from "./picker-types";

export function toPickerMediaItem(media: MediaAsset): PickerMediaItem {
  const id = media.id as string;
  const selectable = media.status === "ready";
  return {
    id,
    title: media.title as string,
    kind: media.kind,
    status: media.status,
    originalFileName: media.originalFileName,
    publicPath: isPubliclyDeliverable(media)
      ? safeMediaPreviewPath(id, `/media/${id}`)
      : null,
    selectable,
    unavailable: !selectable,
  };
}

export function missingPickerMediaItem(id: string): PickerMediaItem {
  return {
    id,
    title: "",
    kind: "",
    status: "missing",
    originalFileName: "",
    publicPath: null,
    selectable: false,
    unavailable: true,
  };
}

export async function lookupPickerMedia(
  ports: Pick<ContentPorts, "media">,
  ids: readonly string[],
): Promise<PickerMediaItem[]> {
  if (!ports.media) return ids.map(missingPickerMediaItem);
  const items: PickerMediaItem[] = [];
  for (const id of ids) {
    if (isUnsetReferenceId(id)) {
      items.push(missingPickerMediaItem(id));
      continue;
    }
    const media = await ports.media.getById(id);
    items.push(media ? toPickerMediaItem(media) : missingPickerMediaItem(id));
  }
  return items;
}

export async function searchPickerMedia(
  ports: Pick<ContentPorts, "media">,
  input: { q?: string | null; kind?: MediaKind; limit?: number },
): Promise<{ items: PickerMediaItem[]; scanLimitExceeded: boolean }> {
  if (!ports.media) {
    return { items: [], scanLimitExceeded: false };
  }
  const limit = Math.min(input.limit ?? PICKER_RESULT_LIMIT, PICKER_RESULT_LIMIT);
  const q = clampPickerQuery(input.q);
  const page = await ports.media.listAdmin(
    {
      status: "ready",
      kind: input.kind,
      q: q || undefined,
      sort: "updatedAt_desc",
    },
    { limit, cursor: null },
  );
  const items = page.items
    .filter((m) => m.status === "ready")
    .map(toPickerMediaItem)
    .slice(0, limit);
  return {
    items,
    scanLimitExceeded: page.scanLimitExceeded,
  };
}
