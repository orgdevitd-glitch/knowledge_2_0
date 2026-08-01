import { UserId } from "@/domain/shared/ids";
import { restoreTagUseCase } from "@/features/content/application/taxonomy-use-cases";
import { revisionOnlyBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyRestoreLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tagId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { tagId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyRestoreLimiter,
    schema: revisionOnlyBodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const tag = await restoreTagUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        tagId,
        data.expectedRevision,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        tag: { id: tag.id, status: tag.status, revision: tag.revision },
      });
    },
  });
}
