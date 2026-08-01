import { UserId } from "@/domain/shared/ids";
import { updateAudience } from "@/features/content/application/taxonomy-use-cases";
import { updateAudienceBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyUpdateLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ audienceId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { audienceId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyUpdateLimiter,
    schema: updateAudienceBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const { csrfToken: _c, expectedRevision, ...patch } = data;
      void _c;
      const audience = await updateAudience(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        audienceId,
        expectedRevision,
        patch,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        audience: {
          id: audience.id,
          slug: audience.slug,
          title: audience.title,
          description: audience.description,
          sortOrder: audience.sortOrder,
          status: audience.status,
          revision: audience.revision,
          createdAt: audience.createdAt,
          updatedAt: audience.updatedAt,
        },
      });
    },
  });
}
