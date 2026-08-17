import { MEDIA_KIND_VALUES, type MediaKindValue } from "@/domain/shared/media-limits";
import { getContentPorts } from "@/server/composition/content-ports";
import { runAdminGet } from "@/server/http/admin-get";
import { adminPickerLimiter } from "@/server/http/admin-mutation";
import {
  parsePickerIds,
  parsePickerLimit,
  clampPickerQuery,
} from "@/features/admin/pickers/picker-limits";
import {
  pickerMethodNotAllowed,
  pickerOkJson,
} from "@/features/admin/pickers/picker-http";
import {
  lookupPickerMedia,
  searchPickerMedia,
} from "@/features/admin/pickers/query-picker-media";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runAdminGet({
    limiter: adminPickerLimiter,
    async handler() {
      const url = new URL(request.url);
      const ids = parsePickerIds(url.searchParams.get("ids"));
      const ports = getContentPorts();

      if (ids.length > 0) {
        const items = await lookupPickerMedia(ports, ids);
        return pickerOkJson({ items, scanLimitExceeded: false });
      }

      const kindRaw = url.searchParams.get("kind");
      const kind =
        kindRaw && (MEDIA_KIND_VALUES as readonly string[]).includes(kindRaw)
          ? (kindRaw as MediaKindValue)
          : undefined;
      const q = clampPickerQuery(url.searchParams.get("q"));
      const limit = parsePickerLimit(url.searchParams.get("limit"));
      const result = await searchPickerMedia(ports, { q, kind, limit });
      return pickerOkJson(result);
    },
  });
}

export function POST() {
  return pickerMethodNotAllowed();
}

export function PUT() {
  return pickerMethodNotAllowed();
}

export function PATCH() {
  return pickerMethodNotAllowed();
}

export function DELETE() {
  return pickerMethodNotAllowed();
}
