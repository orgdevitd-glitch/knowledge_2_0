import { UserId } from "@/domain/shared/ids";
import { reorderAudienceUseCase } from "@/features/content/application/taxonomy-use-cases";
import { reorderAudienceBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyReorderLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ audienceId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { audienceId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyReorderLimiter,
    schema: reorderAudienceBodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const audience = await reorderAudienceUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        audienceId,
        data.expectedRevision,
        data.direction,
        data.position,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        audience: {
          id: audience.id,
          sortOrder: audience.sortOrder,
          revision: audience.revision,
        },
      });
    },
  });
}
