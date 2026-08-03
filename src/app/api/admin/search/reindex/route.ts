import { z } from "zod";

import { reindexSearchEntity } from "@/features/search/application/reindex-entity";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminPublishLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  csrfToken: z.string().min(1),
  entityType: z.enum(["article", "prompt"]),
  entityId: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: adminPublishLimiter,
    schema: bodySchema,
    maxBodyBytes: 8_000,
    async handler({ requestId, data }) {
      const ports = getContentPorts();
      const result = await reindexSearchEntity(ports, {
        entityType: data.entityType,
        entityId: data.entityId,
        requestId,
      });
      return okJson(result);
    },
  });
}
