import { UserId } from "@/domain/shared/ids";
import { updateCategory } from "@/features/content/application/taxonomy-use-cases";
import { updateCategoryBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyUpdateLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ categoryId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { categoryId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyUpdateLimiter,
    schema: updateCategoryBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const { csrfToken: _c, expectedRevision, ...patch } = data;
      void _c;
      const category = await updateCategory(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        categoryId,
        expectedRevision,
        patch,
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
