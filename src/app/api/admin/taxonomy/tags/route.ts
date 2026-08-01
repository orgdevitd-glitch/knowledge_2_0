import { UserId } from "@/domain/shared/ids";
import { createTagUseCase } from "@/features/content/application/taxonomy-use-cases";
import { createTagBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyCreateLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: taxonomyCreateLimiter,
    schema: createTagBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const tag = await createTagUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        {
          title: data.title,
          slug: data.slug,
          description: data.description ?? null,
        },
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
