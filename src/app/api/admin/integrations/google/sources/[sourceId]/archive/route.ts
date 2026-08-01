import { z } from "zod";

import { archiveSourceConnection } from "@/features/integrations/google/application/archive-source-connection";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled } from "@/server/http/admin-get";
import {
  adminSaveLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sourceId: string }> };
const bodySchema = z.object({ csrfToken: z.string().min(1) });

export async function POST(request: Request, { params }: Params) {
  const { sourceId } = await params;
  return runAdminMutation({
    request,
    limiter: adminSaveLimiter,
    schema: bodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId }) {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const connection = await archiveSourceConnection(ports, {
        actorId: principal.uid,
        requestId,
        sourceId,
      });
      return okJson({ connection });
    },
  });
}
