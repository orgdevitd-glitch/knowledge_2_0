import { UserId } from "@/domain/shared/ids";
import { updateTag } from "@/features/content/application/taxonomy-use-cases";
import { updateTagBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyUpdateLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tagId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { tagId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyUpdateLimiter,
    schema: updateTagBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const { csrfToken: _c, expectedRevision, ...patch } = data;
      void _c;
      const tag = await updateTag(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        tagId,
        expectedRevision,
        patch,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        tag: {
          id: tag.id,
          slug: tag.slug,
          title: tag.title,
          description: tag.description,
          status: tag.status,
          revision: tag.revision,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        },
      });
    },
  });
}
