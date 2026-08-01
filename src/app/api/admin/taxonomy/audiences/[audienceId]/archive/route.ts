import { UserId } from "@/domain/shared/ids";
import { archiveAudienceUseCase } from "@/features/content/application/taxonomy-use-cases";
import { revisionOnlyBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyArchiveLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ audienceId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { audienceId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyArchiveLimiter,
    schema: revisionOnlyBodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const audience = await archiveAudienceUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        audienceId,
        data.expectedRevision,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        audience: {
          id: audience.id,
          status: audience.status,
          revision: audience.revision,
        },
      });
    },
  });
}
