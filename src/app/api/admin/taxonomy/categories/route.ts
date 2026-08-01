import { UserId } from "@/domain/shared/ids";
import { createCategoryUseCase } from "@/features/content/application/taxonomy-use-cases";
import { createCategoryBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
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
    schema: createCategoryBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const { csrfToken: _c, ...input } = data;
      void _c;
      const category = await createCategoryUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        {
          title: input.title,
          slug: input.slug,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder,
        },
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        category: {
          id: category.id,
          slug: category.slug,
          title: category.title,
          description: category.description,
          parentId: category.parentId,
          sortOrder: category.sortOrder,
          status: category.status,
          revision: category.revision,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      });
    },
  });
}
