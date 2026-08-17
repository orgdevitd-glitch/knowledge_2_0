import { getContentPorts } from "@/server/composition/content-ports";
import { runAdminGet } from "@/server/http/admin-get";
import { adminPickerLimiter } from "@/server/http/admin-mutation";
import {
  parsePickerIds,
  parsePickerLimit,
  parsePickerExcludeId,
  clampPickerQuery,
} from "@/features/admin/pickers/picker-limits";
import {
  pickerMethodNotAllowed,
  pickerOkJson,
} from "@/features/admin/pickers/picker-http";
import {
  lookupPickerMaterials,
  searchPickerMaterials,
} from "@/features/admin/pickers/query-picker-materials";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runAdminGet({
    limiter: adminPickerLimiter,
    async handler() {
      const url = new URL(request.url);
      const typeRaw = url.searchParams.get("type");
      const entityType =
        typeRaw === "prompt" ? "prompt" : typeRaw === "article" ? "article" : null;
      const articleIds = parsePickerIds(url.searchParams.get("articleIds"));
      const promptIds = parsePickerIds(url.searchParams.get("promptIds"));
      const ports = getContentPorts();

      if (articleIds.length > 0 || promptIds.length > 0) {
        const items = await lookupPickerMaterials(ports, {
          articleIds,
          promptIds,
        });
        return pickerOkJson({ items, scanLimitExceeded: false });
      }

      if (!entityType) {
        return pickerOkJson({ items: [], scanLimitExceeded: false });
      }

      const q = clampPickerQuery(url.searchParams.get("q"));
      const excludeId = parsePickerExcludeId(url.searchParams.get("excludeId"));
      const excludeIds = parsePickerIds(url.searchParams.get("excludeIds"));
      const limit = parsePickerLimit(url.searchParams.get("limit"));
      const result = await searchPickerMaterials(ports, {
        entityType,
        q,
        excludeId,
        excludeIds,
        limit,
      });
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
