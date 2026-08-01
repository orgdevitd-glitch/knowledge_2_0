import { UserId } from "@/domain/shared/ids";
import { createAudienceUseCase } from "@/features/content/application/taxonomy-use-cases";
import { createAudienceBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
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
    schema: createAudienceBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const audience = await createAudienceUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        {
          title: data.title,
          slug: data.slug,
          description: data.description ?? null,
          sortOrder: data.sortOrder,
        },
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
