import { UserId } from "@/domain/shared/ids";
import { reorderCategoryUseCase } from "@/features/content/application/taxonomy-use-cases";
import { reorderCategoryBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyReorderLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ categoryId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { categoryId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyReorderLimiter,
    schema: reorderCategoryBodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const category = await reorderCategoryUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        categoryId,
        data.expectedRevision,
        data.direction,
        data.position,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        category: {
          id: category.id,
          sortOrder: category.sortOrder,
          revision: category.revision,
        },
      });
    },
  });
}
