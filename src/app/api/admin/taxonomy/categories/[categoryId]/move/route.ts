import { UserId } from "@/domain/shared/ids";
import { moveCategoryUseCase } from "@/features/content/application/taxonomy-use-cases";
import { moveCategoryBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyMoveLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ categoryId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { categoryId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyMoveLimiter,
    schema: moveCategoryBodySchema,
    maxBodyBytes: 8_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const category = await moveCategoryUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        categoryId,
        data.expectedRevision,
        data.parentId,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        category: {
          id: category.id,
          parentId: category.parentId,
          sortOrder: category.sortOrder,
          revision: category.revision,
          status: category.status,
        },
      });
    },
  });
}
