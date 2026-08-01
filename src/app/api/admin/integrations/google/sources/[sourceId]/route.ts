import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled, runAdminGet } from "@/server/http/admin-get";
import { okJson } from "@/server/http/admin-mutation";
import { NotFoundError } from "@/domain/shared/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sourceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { sourceId } = await params;
  return runAdminGet({
    async handler() {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const connection = await ports.sources.getById(sourceId);
      if (!connection) {
        throw new NotFoundError("Source connection not found", { sourceId });
      }
      return okJson({ connection });
    },
  });
}
