import { z } from "zod";

import { rebuildSearchIndex } from "@/features/search/application/rebuild-search-index";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminPublishLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  csrfToken: z.string().min(1),
});

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: adminPublishLimiter,
    schema: bodySchema,
    maxBodyBytes: 8_000,
    async handler({ requestId }) {
      const ports = getContentPorts();
      const result = await rebuildSearchIndex(ports, { requestId });
      return okJson(result);
    },
  });
}
