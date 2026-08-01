import { createSourceConnection } from "@/features/integrations/google/application/create-source-connection";
import { createSourceBodySchema } from "@/features/integrations/google/schemas";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled } from "@/server/http/admin-get";
import {
  adminCreateLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: adminCreateLimiter,
    schema: createSourceBodySchema,
    maxBodyBytes: 8_000,
    async handler({ principal, requestId, data }) {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const connection = await createSourceConnection(ports, {
        actorId: principal.uid,
        requestId,
        urlOrId: data.urlOrId,
        targetEntityType: data.targetEntityType,
        targetEntityId: data.targetEntityId ?? null,
      });
      return okJson({ connection }, 201);
    },
  });
}
